import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { assignBrowserLocation } from "@/lib/browserLocation"
import {
  api,
  customerApi,
  resetStaffSessionRefreshForTests,
} from "@/lib/api"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/browserLocation", () => ({
  assignBrowserLocation: vi.fn(),
}))

const STAFF_MARKER = "sb-rolvix-auth-token"
const CUSTOMER_TOKEN = "rolvix.customer.token"
const CUSTOMER_SUBDOMAIN = "rolvix.customer.subdomain"
const CUSTOMER_LABEL = "rolvix.customer.label"

let info: ReturnType<typeof vi.spyOn>

function loggedText(spy: { mock: { calls: ReadonlyArray<readonly unknown[]> } }): string {
  return spy.mock.calls.map((call) => String(call[0])).join("\n")
}

const OLD_STAFF_TOKEN = "old-staff-access-token"
const NEW_STAFF_TOKEN = "new-staff-access-token"
const CUSTOMER_ACCESS_TOKEN = "customer-access-token"
const NEXT_CUSTOMER_TOKEN = "customer-access-token-next"
const REFRESH_SECRET = "refresh-token-secret"
const OTHER_REFRESH_SECRET = "other-refresh-token-secret"
const STAFF_EMAIL = "staff@club.test"
const OTHER_STAFF_EMAIL = "other-staff@club.test"
const CUSTOMER_ID = "rolvix.customer.id"
const CUSTOMER_ID_VALUE = "customer-id-secret"
const NEXT_CUSTOMER_ID = "customer-id-next"

type Outcome =
  | { kind: "status"; status: number }
  | { kind: "network" }

function encodeSegment(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function bearerJwt(exp: number, extra: Record<string, unknown> = {}): string {
  return [
    encodeSegment({ alg: "none", typ: "JWT" }),
    encodeSegment({ exp, ...extra }),
    "sig",
  ].join(".")
}

function authorizationOf(config: InternalAxiosRequestConfig): string | null {
  const headers = config.headers
  if (typeof headers.get === "function") {
    const value = headers.get("Authorization")
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }

  const direct = headers.Authorization ?? headers.authorization
  return typeof direct === "string" && direct.length > 0 ? direct : null
}

function holdStaffRefresh(): { release: (value: unknown) => void } {
  let release: (value: unknown) => void = () => undefined
  const promise = new Promise((resolve) => {
    release = resolve
  })
  vi.mocked(supabase.auth.refreshSession).mockReturnValue(
    promise as ReturnType<typeof supabase.auth.refreshSession>,
  )
  return { release }
}

function refreshedStaffSession(userId: string): unknown {
  return {
    data: {
      session: {
        access_token: NEW_STAFF_TOKEN,
        refresh_token: REFRESH_SECRET,
        user: { id: userId, email: STAFF_EMAIL },
      },
      user: { id: userId, email: STAFF_EMAIL },
    },
    error: null,
  }
}

function requireFunctionAdapter(adapter: typeof api.defaults.adapter) {
  if (typeof adapter !== "function") {
    throw new Error("missing adapter")
  }
  return adapter
}

function installAdapter(
  client: typeof api,
  outcomes: Outcome[],
): string[] {
  const calls: string[] = []
  client.defaults.adapter = (config) => {
    const outcome = outcomes[calls.length] ?? { kind: "status", status: 500 }
    calls.push(authorizationOf(config) ?? "")
    if (outcome.kind === "network") {
      return Promise.reject(
        new AxiosError("Network Error", AxiosError.ERR_NETWORK, config),
      )
    }

    const response = {
      data: { ok: true },
      status: outcome.status,
      statusText: String(outcome.status),
      headers: {},
      config,
    } as AxiosResponse
    if (outcome.status >= 200 && outcome.status < 300) {
      return Promise.resolve(response)
    }

    return Promise.reject(
      new AxiosError(
        "Request failed",
        outcome.status >= 500
          ? AxiosError.ERR_BAD_RESPONSE
          : AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      ),
    )
  }
  return calls
}

beforeEach(() => {
  info = vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  info.mockRestore()
})

describe("staff api 401 retry", () => {
  beforeEach(() => {
    vi.mocked(assignBrowserLocation).mockClear()
    resetStaffSessionRefreshForTests()
    window.localStorage.setItem(STAFF_MARKER, "keep-staff-session")
    vi.mocked(supabase.auth.signOut).mockClear()
    vi.mocked(supabase.auth.refreshSession).mockReset()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: OLD_STAFF_TOKEN,
          refresh_token: REFRESH_SECRET,
          expires_at: Math.floor(Date.now() / 1000) + 45,
          user: { id: "user-1", email: STAFF_EMAIL },
        },
      },
      error: null,
    } as never)
  })

  afterEach(() => {
    window.localStorage.removeItem(STAFF_MARKER)
    resetStaffSessionRefreshForTests()
  })

  it("retries once after a successful refresh and does not sign out", async () => {
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: {
        session: {
          access_token: NEW_STAFF_TOKEN,
          refresh_token: REFRESH_SECRET,
          user: { id: "user-1", email: STAFF_EMAIL },
        },
        user: { id: "user-1", email: STAFF_EMAIL },
      },
      error: null,
    } as never)

    const response = await api.get("/api/users/me?token=query-secret")

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toBe(`Bearer ${OLD_STAFF_TOKEN}`)
    expect(calls[1]).toBe(`Bearer ${NEW_STAFF_TOKEN}`)
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: REFRESH_SECRET,
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).toContain("\"event\":\"API_401\"")
    expect(logged).toContain("\"surface\":\"b2b\"")
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(NEW_STAFF_TOKEN)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(STAFF_EMAIL)
    expect(logged).not.toContain("query-secret")
    expect(logged).toContain("\"requestPath\":\"/api/users/me\"")
  })

  it("signs out locally when refresh returns refresh_token_not_found", async () => {
    const calls = installAdapter(api, [{ kind: "status", status: 401 }])
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError(
        `Invalid Refresh Token ${REFRESH_SECRET}`,
        400,
        "refresh_token_not_found",
      ),
    } as never)

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toHaveLength(1)
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith({
      refresh_token: REFRESH_SECRET,
    })
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
    const logged = loggedText(info)
    expect(logged).toContain("\"errorName\":\"AuthApiError\"")
    expect(logged).toContain("\"errorStatus\":400")
    expect(logged).toContain("\"errorCode\":\"refresh_token_not_found\"")
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
  })

  it.each([
    {
      label: "invalid grant",
      error: new AuthApiError("invalid grant", 400, "invalid_grant"),
    },
    {
      label: "401",
      error: new AuthApiError("unauthorized", 401, "bad_jwt"),
    },
  ])(
    "signs out locally when refresh fails with $label and does not retry",
    async ({ error }) => {
      const calls = installAdapter(api, [{ kind: "status", status: 401 }])
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null, user: null },
        error,
      } as never)

      await expect(api.get("/api/users/me")).rejects.toMatchObject({
        response: { status: 401 },
      })

      expect(calls).toHaveLength(1)
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
      expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
      const logged = loggedText(info)
      expect(logged).not.toContain(REFRESH_SECRET)
      expect(logged).not.toContain(OLD_STAFF_TOKEN)
      expect(logged).not.toContain(STAFF_EMAIL)
    },
  )

  it.each([
    {
      label: "network",
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    },
    {
      label: "5xx",
      error: new AuthApiError("gateway", 503, "unexpected_failure"),
    },
  ])(
    "rejects the original 401 when refresh fails with $label and does not sign out",
    async ({ error }) => {
      const calls = installAdapter(api, [{ kind: "status", status: 401 }])
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null, user: null },
        error,
      } as never)

      await expect(api.get("/api/users/me")).rejects.toMatchObject({
        response: { status: 401 },
      })

      expect(calls).toHaveLength(1)
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
      expect(supabase.auth.signOut).not.toHaveBeenCalled()
      expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
    },
  )

  it("rejects the original 401 when refresh throws a network error and does not sign out", async () => {
    const calls = installAdapter(api, [{ kind: "status", status: 401 }])
    vi.mocked(supabase.auth.refreshSession).mockRejectedValue(
      new TypeError("Failed to fetch"),
    )

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toHaveLength(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
  })

  it.each([
    { label: "403", outcome: { kind: "status", status: 403 } satisfies Outcome },
    { label: "500", outcome: { kind: "status", status: 500 } satisfies Outcome },
    { label: "network", outcome: { kind: "network" } satisfies Outcome },
  ])(
    "does not refresh or clear the session on $label",
    async ({ outcome }) => {
      const calls = installAdapter(api, [outcome])
      const pending = api.get("/api/users/me")
      await expect(pending).rejects.toBeInstanceOf(AxiosError)

      expect(calls).toHaveLength(1)
      expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
      expect(supabase.auth.signOut).not.toHaveBeenCalled()
      expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
      expect(assignBrowserLocation).not.toHaveBeenCalled()
    },
  )

  it("does not refresh a 401 that had no bearer", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)
    const calls = installAdapter(api, [{ kind: "status", status: 401 }])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([""])
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(assignBrowserLocation).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
  })

  it("does not refresh a second time when the retried request is still 401", async () => {
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
    ])
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: {
        session: { access_token: NEW_STAFF_TOKEN },
        user: { id: "user-1" },
      },
      error: null,
    } as never)

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toHaveLength(2)
    expect(calls[1]).toBe(`Bearer ${NEW_STAFF_TOKEN}`)
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("drops the retry when signOut runs while refresh is in flight", async () => {
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])
    const pendingRefresh = holdStaffRefresh()
    const pending = api.get("/api/users/me")

    await vi.waitFor(() => {
      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: REFRESH_SECRET,
      })
    })
    await supabase.auth.signOut()
    pendingRefresh.release(refreshedStaffSession("user-1"))

    await expect(pending).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalledWith({ scope: "local" })
    const logged = loggedText(info)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(NEW_STAFF_TOKEN)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("drops the retry when the stored user changes while refresh is in flight", async () => {
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])
    const pendingRefresh = holdStaffRefresh()
    const pending = api.get("/api/users/me")

    await vi.waitFor(() => {
      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: REFRESH_SECRET,
      })
    })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: "other-staff-access-token",
          refresh_token: OTHER_REFRESH_SECRET,
          user: { id: "user-2", email: OTHER_STAFF_EMAIL },
        },
      },
      error: null,
    } as never)
    pendingRefresh.release(refreshedStaffSession("user-1"))

    await expect(pending).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(NEW_STAFF_TOKEN)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(OTHER_REFRESH_SECRET)
    expect(logged).not.toContain(STAFF_EMAIL)
    expect(logged).not.toContain(OTHER_STAFF_EMAIL)
    expect(logged).not.toContain("other-staff-access-token")
  })
})

describe("customer api 401 retry", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/t/ficc/app")
    window.localStorage.setItem(CUSTOMER_TOKEN, CUSTOMER_ACCESS_TOKEN)
    window.localStorage.setItem(CUSTOMER_SUBDOMAIN, "ficc")
    window.localStorage.setItem(CUSTOMER_LABEL, "FICC")
    window.localStorage.setItem(CUSTOMER_ID, CUSTOMER_ID_VALUE)
    vi.mocked(assignBrowserLocation).mockClear()
    vi.mocked(supabase.auth.signOut).mockClear()
    vi.mocked(supabase.auth.refreshSession).mockClear()
  })

  afterEach(() => {
    window.localStorage.removeItem(CUSTOMER_TOKEN)
    window.localStorage.removeItem(CUSTOMER_SUBDOMAIN)
    window.localStorage.removeItem(CUSTOMER_LABEL)
    window.localStorage.removeItem(CUSTOMER_ID)
    window.history.pushState({}, "", "/")
  })

  it("does not clear storage when a 401 had no bearer", async () => {
    window.localStorage.removeItem(CUSTOMER_TOKEN)
    const calls = installAdapter(customerApi, [{ kind: "status", status: 401 }])

    await expect(customerApi.get("/api/customers/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([""])
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBe("ficc")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
  })

  it("retries the first 401 and keeps the token when the retry succeeds", async () => {
    const calls = installAdapter(customerApi, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    const response = await customerApi.get("/api/customers/me")

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toBe(`Bearer ${CUSTOMER_ACCESS_TOKEN}`)
    expect(calls[1]).toBe(`Bearer ${CUSTOMER_ACCESS_TOKEN}`)
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBe(CUSTOMER_ACCESS_TOKEN)
    expect(window.localStorage.getItem(CUSTOMER_ID)).toBe(CUSTOMER_ID_VALUE)
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBe("ficc")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("clears storage and redirects only when the retry is also 401", async () => {
    const calls = installAdapter(customerApi, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
    ])

    await expect(customerApi.get("/api/customers/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toHaveLength(2)
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBeNull()
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBeNull()
    expect(window.localStorage.getItem(CUSTOMER_LABEL)).toBeNull()
    expect(window.localStorage.getItem(CUSTOMER_ID)).toBeNull()
    expect(assignBrowserLocation).toHaveBeenCalledTimes(1)
    expect(assignBrowserLocation).toHaveBeenCalledWith("/t/ficc")
    const logged = loggedText(info)
    expect(logged).not.toContain(CUSTOMER_ACCESS_TOKEN)
    expect(logged).not.toContain(CUSTOMER_ID_VALUE)
  })

  it.each([
    { label: "403", outcome: { kind: "status", status: 403 } satisfies Outcome },
    { label: "500", outcome: { kind: "status", status: 500 } satisfies Outcome },
    { label: "network", outcome: { kind: "network" } satisfies Outcome },
  ])("leaves the customer token in place on $label", async ({ outcome }) => {
    const calls = installAdapter(customerApi, [outcome])

    await expect(customerApi.get("/api/reservations/mine")).rejects.toBeInstanceOf(
      AxiosError,
    )

    expect(calls).toHaveLength(1)
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBe(CUSTOMER_ACCESS_TOKEN)
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBe("ficc")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
  })

  it.each([
    { label: "403", outcome: { kind: "status", status: 403 } satisfies Outcome },
    { label: "500", outcome: { kind: "status", status: 500 } satisfies Outcome },
    { label: "network", outcome: { kind: "network" } satisfies Outcome },
  ])(
    "does not clear the token when the 401 retry returns $label",
    async ({ outcome }) => {
      const calls = installAdapter(customerApi, [
        { kind: "status", status: 401 },
        outcome,
      ])

      await expect(customerApi.get("/api/reservations/mine")).rejects.toBeInstanceOf(
        AxiosError,
      )

      expect(calls).toHaveLength(2)
      expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBe(CUSTOMER_ACCESS_TOKEN)
      expect(assignBrowserLocation).not.toHaveBeenCalled()
    },
  )

  it("does not replay or clear a login that replaced the 401 bearer", async () => {
    const calls = installAdapter(customerApi, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])
    const inner = requireFunctionAdapter(customerApi.defaults.adapter)
    customerApi.defaults.adapter = (config) => {
      window.localStorage.setItem(CUSTOMER_TOKEN, NEXT_CUSTOMER_TOKEN)
      window.localStorage.setItem(CUSTOMER_ID, NEXT_CUSTOMER_ID)
      return inner(config)
    }

    const error = await customerApi.get("/api/customers/me").then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(AxiosError)
    if (!(error instanceof AxiosError) || error.config === undefined) {
      throw new Error("expected the original 401")
    }
    expect(error.response?.status).toBe(401)
    expect(authorizationOf(error.config)).toBeNull()
    expect(calls).toEqual([`Bearer ${CUSTOMER_ACCESS_TOKEN}`])
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBe(NEXT_CUSTOMER_TOKEN)
    expect(window.localStorage.getItem(CUSTOMER_ID)).toBe(NEXT_CUSTOMER_ID)
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBe("ficc")
    expect(window.localStorage.getItem(CUSTOMER_LABEL)).toBe("FICC")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(CUSTOMER_ACCESS_TOKEN)
    expect(logged).not.toContain(NEXT_CUSTOMER_TOKEN)
    expect(logged).not.toContain(CUSTOMER_ID_VALUE)
    expect(logged).not.toContain(NEXT_CUSTOMER_ID)
  })

  it("does not retry when the customer token is already gone", async () => {
    const calls = installAdapter(customerApi, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])
    const inner = requireFunctionAdapter(customerApi.defaults.adapter)
    customerApi.defaults.adapter = (config) => {
      window.localStorage.removeItem(CUSTOMER_TOKEN)
      return inner(config)
    }

    const error = await customerApi.get("/api/customers/me").then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(AxiosError)
    if (!(error instanceof AxiosError) || error.config === undefined) {
      throw new Error("expected the original 401")
    }
    expect(authorizationOf(error.config)).toBeNull()
    expect(calls).toEqual([`Bearer ${CUSTOMER_ACCESS_TOKEN}`])
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBeNull()
    expect(window.localStorage.getItem(CUSTOMER_ID)).toBe(CUSTOMER_ID_VALUE)
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBe("ficc")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
  })

  it("does not clear a replacement login when the retried request is 401", async () => {
    const calls = installAdapter(customerApi, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
    ])
    const inner = requireFunctionAdapter(customerApi.defaults.adapter)
    customerApi.defaults.adapter = (config) => {
      const pending = inner(config)
      if (calls.length === 2) {
        window.localStorage.setItem(CUSTOMER_TOKEN, NEXT_CUSTOMER_TOKEN)
        window.localStorage.setItem(CUSTOMER_ID, NEXT_CUSTOMER_ID)
      }
      return pending
    }

    await expect(customerApi.get("/api/customers/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([
      `Bearer ${CUSTOMER_ACCESS_TOKEN}`,
      `Bearer ${CUSTOMER_ACCESS_TOKEN}`,
    ])
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBe(NEXT_CUSTOMER_TOKEN)
    expect(window.localStorage.getItem(CUSTOMER_ID)).toBe(NEXT_CUSTOMER_ID)
    expect(window.localStorage.getItem(CUSTOMER_SUBDOMAIN)).toBe("ficc")
    expect(window.localStorage.getItem(CUSTOMER_LABEL)).toBe("FICC")
    expect(assignBrowserLocation).not.toHaveBeenCalled()
  })

  it("does not send a stale bearer on a retry after the token changed", async () => {
    window.localStorage.setItem(CUSTOMER_TOKEN, NEXT_CUSTOMER_TOKEN)
    const calls = installAdapter(customerApi, [{ kind: "status", status: 200 }])

    const response = await customerApi.get("/api/customers/me", {
      rolvixCustomerAuthRetry: true,
      headers: { Authorization: `Bearer ${CUSTOMER_ACCESS_TOKEN}` },
    })

    expect(response.status).toBe(200)
    expect(calls).toEqual([""])
    expect(window.localStorage.getItem(CUSTOMER_TOKEN)).toBe(NEXT_CUSTOMER_TOKEN)
    expect(window.localStorage.getItem(CUSTOMER_ID)).toBe(CUSTOMER_ID_VALUE)
  })
})

describe("staff api session log expiry", () => {
  beforeEach(() => {
    resetStaffSessionRefreshForTests()
    vi.mocked(supabase.auth.signOut).mockClear()
    vi.mocked(supabase.auth.refreshSession).mockReset()
  })

  it("logs expiresInSec from the bearer exp without the other claims", async () => {
    const exp = Math.floor(Date.now() / 1000) + 75
    const token = bearerJwt(exp, {
      email: STAFF_EMAIL,
      sub: "customer-secret-id",
      phone: "+5511988887777",
    })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: token, user: { id: "user-1" } } },
      error: null,
    } as never)
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("nope", 400, "refresh_token_not_found"),
    } as never)
    installAdapter(api, [{ kind: "status", status: 401 }])

    await expect(api.get("/api/users/me")).rejects.toBeInstanceOf(AxiosError)

    const raw = loggedText(info)
    const line = JSON.parse(
      raw.split("\n").find((entry) => entry.includes("\"event\":\"API_401\"")) ??
        "{}",
    ) as { expiresInSec: number }
    expect(line.expiresInSec).toBeGreaterThanOrEqual(74)
    expect(line.expiresInSec).toBeLessThanOrEqual(76)
    expect(raw).not.toContain(token)
    expect(raw).not.toContain(STAFF_EMAIL)
    expect(raw).not.toContain("customer-secret-id")
    expect(raw).not.toContain("+5511988887777")
  })
})
