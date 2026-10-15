import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"
import {
  AuthApiError,
  AuthError,
  AuthRefreshDiscardedError,
  AuthRetryableFetchError,
} from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { assignBrowserLocation } from "@/lib/browserLocation"
import {
  api,
  customerApi,
  resetStaffSessionRefreshForTests,
  setStaffSignInImplForTests,
  setStaffVerifyOtpImplForTests,
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
const ROTATED_REFRESH = "rotated-refresh-token"
const SIGNED_IN_REFRESH = "signed-in-refresh-token"
const LATER_REFRESH = "later-refresh-token"
const QUEUED_ACCESS = "queued-staff-access-token"
const LATER_ACCESS = "later-staff-access-token"
const SIGNED_IN_ACCESS = "signed-in-staff-access-token"
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

type StoredStaffSession = {
  access_token: string
  refresh_token: string
  expires_at: number
  user: { id: string; email: string }
}

type AuthJsRefreshOutcome =
  | { kind: "success"; session: StoredStaffSession }
  | { kind: "terminal"; error: AuthApiError }

function staffStoredSession(
  refreshToken: string,
  accessToken: string,
  userId = "user-1",
): StoredStaffSession {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: userId,
      email: userId === "user-1" ? STAFF_EMAIL : OTHER_STAFF_EMAIL,
    },
  }
}

function sessionPayload(session: StoredStaffSession | null) {
  return {
    data: { session },
    error: null,
  } as never
}

/**
 * Applies a refresh the way auth-js 2.110.2 `_callRefreshToken` does:
 * discard the rotated session when storage changed during the fetch, and on a
 * terminal auth error keep the stored session only while its access token is
 * still valid.
 */
function authJsRefreshResult(
  storedAtStart: string | null,
  stored: { current: StoredStaffSession | null },
  outcome: AuthJsRefreshOutcome,
) {
  if (outcome.kind === "terminal") {
    const current = stored.current
    const accessStillValid =
      current !== null && current.expires_at * 1000 > Date.now()
    if (!accessStillValid) {
      stored.current = null
    }
    return {
      data: { session: null, user: null },
      error: outcome.error,
    } as never
  }

  const storedAfter = stored.current
  const storageChanged =
    storedAtStart !== null &&
    (storedAfter === null || storedAfter.refresh_token !== storedAtStart)
  if (storageChanged) {
    return {
      data: { session: null, user: null },
      error: new AuthRefreshDiscardedError(),
    } as never
  }

  stored.current = outcome.session
  return {
    data: { session: outcome.session, user: outcome.session.user },
    error: null,
  } as never
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

  it("retries after auth-js saves the rotated refresh token for the same user", async () => {
    const stored = {
      current: staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN),
    }
    const rotated = staffStoredSession(ROTATED_REFRESH, NEW_STAFF_TOKEN)
    vi.mocked(supabase.auth.getSession).mockImplementation(async () =>
      sessionPayload(stored.current),
    )
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async () => {
      const storedAtStart = stored.current?.refresh_token ?? null
      return authJsRefreshResult(storedAtStart, stored, {
        kind: "success",
        session: rotated,
      })
    })
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    const response = await api.get("/api/users/me")

    expect(response.status).toBe(200)
    expect(calls).toEqual([
      `Bearer ${OLD_STAFF_TOKEN}`,
      `Bearer ${NEW_STAFF_TOKEN}`,
    ])
    expect(stored.current?.refresh_token).toBe(ROTATED_REFRESH)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(ROTATED_REFRESH)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(NEW_STAFF_TOKEN)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("does not replay a refresh access token over a newer stored refresh token", async () => {
    const original = staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN)
    const replacement = staffStoredSession(SIGNED_IN_REFRESH, SIGNED_IN_ACCESS)
    let refreshFinished = false
    vi.mocked(supabase.auth.getSession).mockImplementation(async () =>
      sessionPayload(refreshFinished ? replacement : original),
    )
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async () => {
      refreshFinished = true
      return {
        data: {
          session: {
            access_token: NEW_STAFF_TOKEN,
            refresh_token: ROTATED_REFRESH,
            user: { id: "user-1", email: STAFF_EMAIL },
          },
          user: { id: "user-1", email: STAFF_EMAIL },
        },
        error: null,
      } as never
    })
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(ROTATED_REFRESH)
    expect(logged).not.toContain(SIGNED_IN_REFRESH)
    expect(logged).not.toContain(NEW_STAFF_TOKEN)
    expect(logged).not.toContain(SIGNED_IN_ACCESS)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("signs out locally when auth-js keeps the failed refresh token", async () => {
    const stored = {
      current: staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN),
    }
    vi.mocked(supabase.auth.getSession).mockImplementation(async () =>
      sessionPayload(stored.current),
    )
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async () => {
      const storedAtStart = stored.current?.refresh_token ?? null
      return authJsRefreshResult(storedAtStart, stored, {
        kind: "terminal",
        error: new AuthApiError(
          "Invalid Refresh Token",
          400,
          "refresh_token_not_found",
        ),
      })
    })
    const calls = installAdapter(api, [{ kind: "status", status: 401 }])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(stored.current?.refresh_token).toBe(REFRESH_SECRET)
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("does not sign out when a terminal refresh error belongs to a replaced refresh token", async () => {
    const stored = {
      current: staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN),
    }
    const replacement = staffStoredSession(SIGNED_IN_REFRESH, SIGNED_IN_ACCESS)
    let release: (error: AuthApiError) => void = () => undefined
    const gate = new Promise<AuthApiError>((resolve) => {
      release = resolve
    })
    vi.mocked(supabase.auth.getSession).mockImplementation(async () =>
      sessionPayload(stored.current),
    )
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async () => {
      const storedAtStart = stored.current?.refresh_token ?? null
      const error = await gate
      return authJsRefreshResult(storedAtStart, stored, {
        kind: "terminal",
        error,
      })
    })
    const calls = installAdapter(api, [{ kind: "status", status: 401 }])
    const pending = api.get("/api/users/me")

    await vi.waitFor(() => {
      expect(supabase.auth.refreshSession).toHaveBeenCalledWith({
        refresh_token: REFRESH_SECRET,
      })
    })
    stored.current = replacement
    release(
      new AuthApiError(
        "Invalid Refresh Token",
        400,
        "refresh_token_not_found",
      ),
    )

    await expect(pending).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(stored.current?.refresh_token).toBe(SIGNED_IN_REFRESH)
    expect(stored.current?.access_token).toBe(SIGNED_IN_ACCESS)
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(SIGNED_IN_REFRESH)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(SIGNED_IN_ACCESS)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("does not exchange a queued refresh token after the stored session moves on", async () => {
    const stored = {
      current: staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN),
    }
    const queued = staffStoredSession(OTHER_REFRESH_SECRET, QUEUED_ACCESS)
    const later = staffStoredSession(LATER_REFRESH, LATER_ACCESS)
    let reads = 0
    vi.mocked(supabase.auth.getSession).mockImplementation(async () => {
      reads += 1
      return sessionPayload(stored.current)
    })
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const refreshCalls: string[] = []
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async (current) => {
      const token = current?.refresh_token ?? ""
      refreshCalls.push(token)
      const storedAtStart = stored.current?.refresh_token ?? null
      if (refreshCalls.length === 1) {
        await gate
      }
      return authJsRefreshResult(storedAtStart, stored, {
        kind: "success",
        session: staffStoredSession(`rotated-slot-${refreshCalls.length}`, NEW_STAFF_TOKEN),
      })
    })
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
    ])
    const first = api.get("/api/users/me")

    await vi.waitFor(() => {
      expect(refreshCalls).toEqual([REFRESH_SECRET])
    })
    stored.current = queued
    const second = api.get("/api/orders")
    await vi.waitFor(() => {
      expect(reads).toBeGreaterThanOrEqual(4)
    })
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(refreshCalls).toEqual([REFRESH_SECRET])
    stored.current = later
    release()

    await expect(first).rejects.toMatchObject({
      response: { status: 401 },
    })
    await expect(second).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refreshCalls).toEqual([REFRESH_SECRET])
    expect(stored.current?.refresh_token).toBe(LATER_REFRESH)
    expect(stored.current?.access_token).toBe(LATER_ACCESS)
    expect(calls).toEqual([
      `Bearer ${OLD_STAFF_TOKEN}`,
      `Bearer ${QUEUED_ACCESS}`,
    ])
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(OTHER_REFRESH_SECRET)
    expect(logged).not.toContain(LATER_REFRESH)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(QUEUED_ACCESS)
    expect(logged).not.toContain(LATER_ACCESS)
    expect(logged).not.toContain(NEW_STAFF_TOKEN)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("drops the retry when sign-in establishes a session during refresh", async () => {
    const stored = {
      current: staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN),
    }
    const rotated = staffStoredSession(ROTATED_REFRESH, NEW_STAFF_TOKEN)
    let refreshSettled = false
    let signedIn = false
    vi.mocked(supabase.auth.getSession).mockImplementation(async () => {
      if (refreshSettled && !signedIn) {
        signedIn = true
        await supabase.auth.signInWithPassword({
          email: STAFF_EMAIL,
          password: "password1",
        })
      }
      return sessionPayload(stored.current)
    })
    setStaffSignInImplForTests(async () => {
      return {
        data: {
          user: rotated.user,
          session: rotated,
        },
        error: null,
      } as never
    })
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async () => {
      const storedAtStart = stored.current?.refresh_token ?? null
      const result = authJsRefreshResult(storedAtStart, stored, {
        kind: "success",
        session: rotated,
      })
      refreshSettled = true
      return result
    })
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(stored.current?.refresh_token).toBe(ROTATED_REFRESH)
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(ROTATED_REFRESH)
    expect(logged).not.toContain("password1")
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("drops the retry when verifyOtp establishes a session during refresh", async () => {
    const stored = {
      current: staffStoredSession(REFRESH_SECRET, OLD_STAFF_TOKEN),
    }
    const rotated = staffStoredSession(ROTATED_REFRESH, NEW_STAFF_TOKEN)
    let refreshSettled = false
    let verified = false
    vi.mocked(supabase.auth.getSession).mockImplementation(async () => {
      if (refreshSettled && !verified) {
        verified = true
        await supabase.auth.verifyOtp({
          token_hash: "recovery-hash",
          type: "recovery",
        })
      }
      return sessionPayload(stored.current)
    })
    setStaffVerifyOtpImplForTests(async () => {
      return {
        data: {
          user: rotated.user,
          session: rotated,
        },
        error: null,
      } as never
    })
    vi.mocked(supabase.auth.refreshSession).mockImplementation(async () => {
      const storedAtStart = stored.current?.refresh_token ?? null
      const result = authJsRefreshResult(storedAtStart, stored, {
        kind: "success",
        session: rotated,
      })
      refreshSettled = true
      return result
    })
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(calls).toEqual([`Bearer ${OLD_STAFF_TOKEN}`])
    expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(stored.current?.refresh_token).toBe(ROTATED_REFRESH)
    const logged = loggedText(info)
    expect(logged).not.toContain("recovery-hash")
    expect(logged).not.toContain(ROTATED_REFRESH)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("still retries when sign-in does not establish a session", async () => {
    setStaffSignInImplForTests(async () => {
      return {
        data: { user: null, session: null, weakPassword: null },
        error: new AuthError("Invalid login credentials"),
      } as never
    })
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
    await supabase.auth.signInWithPassword({
      email: STAFF_EMAIL,
      password: "password1",
    })
    pendingRefresh.release(refreshedStaffSession("user-1"))

    const response = await pending
    expect(response.status).toBe(200)
    expect(calls).toEqual([
      `Bearer ${OLD_STAFF_TOKEN}`,
      `Bearer ${NEW_STAFF_TOKEN}`,
    ])
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain("password1")
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(STAFF_EMAIL)
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
