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
  noteStaffSignIn,
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
const CUSTOMER_TENANT_ID = "rolvix.customer.tenantId"
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
    window.history.replaceState({}, "", "/")
    resetStaffSessionRefreshForTests()
  })

  it("keeps the tenant and original staff URL when an expired session cannot refresh", async () => {
    window.history.replaceState({}, "", "/os?company=ficc&status=open#details")
    installAdapter(api, [{ kind: "status", status: 401 }])
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Refresh token expired", 400, "refresh_token_not_found"),
    } as never)

    await expect(api.get("/api/users/me")).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(assignBrowserLocation).toHaveBeenCalledWith(
      "/login?next=%2Fos%3Fcompany%3Dficc%26status%3Dopen%23details&company=ficc",
    )
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
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith()
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
    expect(supabase.auth.refreshSession).toHaveBeenCalledWith()
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(assignBrowserLocation).toHaveBeenCalledWith("/login")
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
      expect(assignBrowserLocation).not.toHaveBeenCalled()
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
    expect(assignBrowserLocation).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(STAFF_MARKER)).toBe("keep-staff-session")
  })

  it("does not sign out or redirect when a terminal refresh re-read belongs to another user", async () => {
    const oldSession = {
      data: { session: { access_token: OLD_STAFF_TOKEN, refresh_token: REFRESH_SECRET, user: { id: "user-1", email: STAFF_EMAIL } } },
      error: null,
    }
    vi.mocked(supabase.auth.getSession)
      .mockResolvedValueOnce(oldSession as never)
      .mockResolvedValueOnce(oldSession as never)
      .mockResolvedValueOnce(oldSession as never)
      .mockResolvedValueOnce({
        data: { session: { access_token: "other-staff-access-token", refresh_token: OTHER_REFRESH_SECRET, user: { id: "user-2", email: OTHER_STAFF_EMAIL } } },
        error: null,
      } as never)
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
    } as never)
    installAdapter(api, [{ kind: "status", status: 401 }])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({ response: { status: 401 } })

    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(assignBrowserLocation).not.toHaveBeenCalled()
  })

  it("does not sign out or redirect when the staff auth epoch changes during a terminal refresh", async () => {
    const oldSession = {
      data: { session: { access_token: OLD_STAFF_TOKEN, refresh_token: REFRESH_SECRET, user: { id: "user-1", email: STAFF_EMAIL } } },
      error: null,
    }
    vi.mocked(supabase.auth.getSession)
      .mockResolvedValueOnce(oldSession as never)
      .mockResolvedValueOnce(oldSession as never)
      .mockResolvedValueOnce(oldSession as never)
      .mockImplementationOnce(async () => {
        noteStaffSignIn()
        return oldSession as never
      })
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
    } as never)
    installAdapter(api, [{ kind: "status", status: 401 }])

    await expect(api.get("/api/users/me")).rejects.toMatchObject({ response: { status: 401 } })

    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(assignBrowserLocation).not.toHaveBeenCalled()
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
      expect(supabase.auth.refreshSession).toHaveBeenCalledWith()
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
      expect(supabase.auth.refreshSession).toHaveBeenCalledWith()
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

const ROTATED_ACCESS = "rotated-staff-access-token"
const ROTATED_REFRESH = "rotated-refresh-token"
const QUEUED_ACCESS = "queued-staff-access-token"
const QUEUED_REFRESH = "queued-refresh-token"
const INFLIGHT_ACCESS = "inflight-staff-access-token"
const INFLIGHT_REFRESH = "inflight-refresh-token"
const SIGNED_IN_ACCESS = "signed-in-staff-access-token"
const SIGNED_IN_REFRESH = "signed-in-refresh-token"

type StaffStoredSession = {
  accessToken: string
  refreshToken: string
  userId: string
  email: string
  expiresAt: number
}

type RefreshScript =
  | { kind: "success"; accessToken: string; refreshToken: string }
  | { kind: "terminal"; error: AuthApiError }

function futureExpiry(): number {
  return Math.floor(Date.now() / 1000) + 3600
}

function staffSession(input: {
  accessToken: string
  refreshToken: string
  userId?: string
  email?: string
  expiresAt?: number
}): StaffStoredSession {
  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    userId: input.userId ?? "user-1",
    email: input.email ?? STAFF_EMAIL,
    expiresAt: input.expiresAt ?? futureExpiry(),
  }
}

function createAuthJsSession() {
  let stored: StaffStoredSession | null = null
  const refreshCalls: string[] = []
  const waiters = new Map<string, Array<(script: RefreshScript) => void>>()
  const planned = new Map<string, RefreshScript>()

  function install(): void {
    vi.mocked(supabase.auth.getSession).mockImplementation(async () => {
      if (stored === null) {
        return { data: { session: null }, error: null } as never
      }

      return {
        data: {
          session: {
            access_token: stored.accessToken,
            refresh_token: stored.refreshToken,
            expires_at: stored.expiresAt,
            user: { id: stored.userId, email: stored.email },
          },
        },
        error: null,
      } as never
    })

    vi.mocked(supabase.auth.refreshSession).mockImplementation(async (args) => {
      const refreshToken =
        typeof args?.refresh_token === "string"
          ? args.refresh_token
          : stored?.refreshToken ?? ""
      refreshCalls.push(refreshToken)
      const started = stored
      const script = await scriptFor(refreshToken)
      const after = stored
      const storageChanged =
        started !== null &&
        (after === null || after.refreshToken !== started.refreshToken)

      if (script.kind === "success") {
        if (!storageChanged && started !== null) {
          stored = {
            accessToken: script.accessToken,
            refreshToken: script.refreshToken,
            userId: started.userId,
            email: started.email,
            expiresAt: futureExpiry(),
          }
        }

        if (storageChanged || stored === null) {
          return {
            data: { session: null, user: null },
            error: { name: "AuthRefreshDiscardedError", status: 409, message: "discarded" },
          } as never
        }

        return {
          data: {
            session: {
              access_token: stored.accessToken,
              refresh_token: stored.refreshToken,
              expires_at: stored.expiresAt,
              user: { id: stored.userId, email: stored.email },
            },
            user: { id: stored.userId, email: stored.email },
          },
          error: null,
        } as never
      }

      const accessStillValid =
        after !== null && after.expiresAt * 1000 > Date.now()
      if (!accessStillValid) {
        stored = null
      }

      return {
        data: { session: null, user: null },
        error: script.error,
      } as never
    })
  }

  function scriptFor(refreshToken: string): Promise<RefreshScript> {
    const bucket = waiters.get(refreshToken)
    if (bucket) {
      return new Promise((resolve) => {
        bucket.push(resolve)
      })
    }

    return Promise.resolve(
      planned.get(refreshToken) ?? {
        kind: "success",
        accessToken: "unexpected-refresh-access-token",
        refreshToken: "unexpected-refresh-token",
      },
    )
  }

  return {
    refreshCalls,
    install,
    read: () => stored,
    write: (session: StaffStoredSession | null) => {
      stored = session
    },
    plan(refreshToken: string, script: RefreshScript) {
      planned.set(refreshToken, script)
    },
    hold(refreshToken: string) {
      waiters.set(refreshToken, [])
    },
    release(refreshToken: string, script: RefreshScript) {
      const bucket = waiters.get(refreshToken) ?? []
      waiters.delete(refreshToken)
      for (const resolve of bucket) {
        resolve(script)
      }
    },
  }
}

async function flushTurns(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve()
  }
}

describe("staff api 401 refresh binding", () => {
  beforeEach(() => {
    resetStaffSessionRefreshForTests()
    vi.mocked(supabase.auth.signOut).mockClear()
    vi.mocked(supabase.auth.refreshSession).mockReset()
    vi.mocked(assignBrowserLocation).mockClear()
  })

  afterEach(() => {
    resetStaffSessionRefreshForTests()
  })

  it("retries once after refresh saves the rotated session", async () => {
    const session = createAuthJsSession()
    const original = staffSession({
      accessToken: OLD_STAFF_TOKEN,
      refreshToken: REFRESH_SECRET,
    })
    session.write(original)
    session.install()
    session.plan(REFRESH_SECRET, {
      kind: "success",
      accessToken: ROTATED_ACCESS,
      refreshToken: ROTATED_REFRESH,
    })
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    const response = await api.get("/api/users/me")

    expect(response.status).toBe(200)
    expect(calls).toEqual([
      `Bearer ${OLD_STAFF_TOKEN}`,
      `Bearer ${ROTATED_ACCESS}`,
    ])
    expect(session.refreshCalls).toEqual([REFRESH_SECRET])
    expect(session.read()).toMatchObject({
      accessToken: ROTATED_ACCESS,
      refreshToken: ROTATED_REFRESH,
      userId: "user-1",
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
    expect(logged).not.toContain(ROTATED_ACCESS)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(ROTATED_REFRESH)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("shares one refresh across concurrent 401s for the same stored token", async () => {
    const session = createAuthJsSession()
    session.write(
      staffSession({
        accessToken: OLD_STAFF_TOKEN,
        refreshToken: REFRESH_SECRET,
      }),
    )
    session.install()
    session.hold(REFRESH_SECRET)
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
      { kind: "status", status: 200 },
    ])

    const first = api.get("/api/users/me")
    await vi.waitFor(() => {
      expect(session.refreshCalls).toEqual([REFRESH_SECRET])
    })
    const second = api.get("/api/users/me")
    await vi.waitFor(() => {
      expect(calls).toHaveLength(2)
    })
    await flushTurns()

    expect(session.refreshCalls).toEqual([REFRESH_SECRET])
    session.release(REFRESH_SECRET, {
      kind: "success",
      accessToken: ROTATED_ACCESS,
      refreshToken: ROTATED_REFRESH,
    })

    const responses = await Promise.all([first, second])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(calls).toEqual([
      `Bearer ${OLD_STAFF_TOKEN}`,
      `Bearer ${OLD_STAFF_TOKEN}`,
      `Bearer ${ROTATED_ACCESS}`,
      `Bearer ${ROTATED_ACCESS}`,
    ])
    expect(session.refreshCalls).toEqual([REFRESH_SECRET])
    expect(session.read()?.refreshToken).toBe(ROTATED_REFRESH)
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("does not exchange a queued refresh token after re-login replaces the session", async () => {
    const session = createAuthJsSession()
    session.write(
      staffSession({
        accessToken: INFLIGHT_ACCESS,
        refreshToken: INFLIGHT_REFRESH,
      }),
    )
    session.install()
    session.hold(INFLIGHT_REFRESH)
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    const inflight = api.get("/api/users/me")
    await vi.waitFor(() => {
      expect(session.refreshCalls).toEqual([INFLIGHT_REFRESH])
    })

    session.write(
      staffSession({
        accessToken: QUEUED_ACCESS,
        refreshToken: QUEUED_REFRESH,
      }),
    )
    const queued = api.get("/api/rentals")
    await vi.waitFor(() => {
      expect(vi.mocked(supabase.auth.getSession).mock.calls.length).toBeGreaterThanOrEqual(4)
    })
    await flushTurns()
    expect(session.refreshCalls).toEqual([INFLIGHT_REFRESH])
    expect(calls.map((authorization) => authorization.length > 0)).toEqual([
      true,
      true,
    ])

    noteStaffSignIn()
    session.write(
      staffSession({
        accessToken: SIGNED_IN_ACCESS,
        refreshToken: SIGNED_IN_REFRESH,
      }),
    )
    session.release(INFLIGHT_REFRESH, {
      kind: "success",
      accessToken: ROTATED_ACCESS,
      refreshToken: ROTATED_REFRESH,
    })

    await expect(inflight).rejects.toMatchObject({ response: { status: 401 } })
    await expect(queued).rejects.toMatchObject({ response: { status: 401 } })
    expect(session.refreshCalls).toEqual([INFLIGHT_REFRESH])
    expect(session.read()).toMatchObject({
      accessToken: SIGNED_IN_ACCESS,
      refreshToken: SIGNED_IN_REFRESH,
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(calls).toEqual([
      `Bearer ${INFLIGHT_ACCESS}`,
      `Bearer ${QUEUED_ACCESS}`,
    ])
    const logged = loggedText(info)
    expect(logged).not.toContain(INFLIGHT_REFRESH)
    expect(logged).not.toContain(QUEUED_REFRESH)
    expect(logged).not.toContain(SIGNED_IN_REFRESH)
    expect(logged).not.toContain(SIGNED_IN_ACCESS)
    expect(logged).not.toContain(STAFF_EMAIL)
  })

  it("retries with the current session when a queued token is replaced without sign-in", async () => {
    const session = createAuthJsSession()
    session.write(
      staffSession({
        accessToken: INFLIGHT_ACCESS,
        refreshToken: INFLIGHT_REFRESH,
      }),
    )
    session.install()
    session.hold(INFLIGHT_REFRESH)
    const calls = installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
      { kind: "status", status: 200 },
    ])

    const inflight = api.get("/api/users/me")
    await vi.waitFor(() => {
      expect(session.refreshCalls).toEqual([INFLIGHT_REFRESH])
    })
    session.write(
      staffSession({
        accessToken: QUEUED_ACCESS,
        refreshToken: QUEUED_REFRESH,
      }),
    )
    const queued = api.get("/api/rentals")
    await vi.waitFor(() => {
      expect(vi.mocked(supabase.auth.getSession).mock.calls.length).toBeGreaterThanOrEqual(4)
    })
    await flushTurns()
    expect(session.refreshCalls).toEqual([INFLIGHT_REFRESH])

    session.write(
      staffSession({
        accessToken: SIGNED_IN_ACCESS,
        refreshToken: SIGNED_IN_REFRESH,
      }),
    )
    session.release(INFLIGHT_REFRESH, {
      kind: "success",
      accessToken: ROTATED_ACCESS,
      refreshToken: ROTATED_REFRESH,
    })

    const responses = await Promise.all([inflight, queued])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(session.refreshCalls).toEqual([INFLIGHT_REFRESH])
    expect(session.read()).toMatchObject({
      accessToken: SIGNED_IN_ACCESS,
      refreshToken: SIGNED_IN_REFRESH,
    })
    expect(calls).toEqual([
      `Bearer ${INFLIGHT_ACCESS}`,
      `Bearer ${QUEUED_ACCESS}`,
      `Bearer ${SIGNED_IN_ACCESS}`,
      `Bearer ${SIGNED_IN_ACCESS}`,
    ])
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("does not sign out when a terminal refresh error belongs to a replaced token", async () => {
    const session = createAuthJsSession()
    session.write(
      staffSession({
        accessToken: OLD_STAFF_TOKEN,
        refreshToken: REFRESH_SECRET,
        expiresAt: Math.floor(Date.now() / 1000) - 60,
      }),
    )
    session.install()
    session.hold(REFRESH_SECRET)
    installAdapter(api, [
      { kind: "status", status: 401 },
      { kind: "status", status: 200 },
    ])

    const pending = api.get("/api/users/me")
    await vi.waitFor(() => {
      expect(session.refreshCalls).toEqual([REFRESH_SECRET])
    })
    session.write(
      staffSession({
        accessToken: SIGNED_IN_ACCESS,
        refreshToken: SIGNED_IN_REFRESH,
      }),
    )
    session.release(REFRESH_SECRET, {
      kind: "terminal",
      error: new AuthApiError(
        "Invalid Refresh Token",
        400,
        "refresh_token_not_found",
      ),
    })

    await expect(pending).resolves.toMatchObject({ status: 200 })
    expect(session.refreshCalls).toEqual([REFRESH_SECRET])
    expect(session.read()).toMatchObject({
      accessToken: SIGNED_IN_ACCESS,
      refreshToken: SIGNED_IN_REFRESH,
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    const logged = loggedText(info)
    expect(logged).not.toContain(REFRESH_SECRET)
    expect(logged).not.toContain(SIGNED_IN_REFRESH)
    expect(logged).not.toContain(SIGNED_IN_ACCESS)
    expect(logged).not.toContain(OLD_STAFF_TOKEN)
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
    window.localStorage.setItem(
      CUSTOMER_TENANT_ID,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    )
    vi.mocked(assignBrowserLocation).mockClear()
    vi.mocked(supabase.auth.signOut).mockClear()
    vi.mocked(supabase.auth.refreshSession).mockClear()
  })

  afterEach(() => {
    window.localStorage.removeItem(CUSTOMER_TOKEN)
    window.localStorage.removeItem(CUSTOMER_SUBDOMAIN)
    window.localStorage.removeItem(CUSTOMER_LABEL)
    window.localStorage.removeItem(CUSTOMER_ID)
    window.localStorage.removeItem(CUSTOMER_TENANT_ID)
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
    expect(window.localStorage.getItem(CUSTOMER_TENANT_ID)).toBeNull()
    expect(assignBrowserLocation).toHaveBeenCalledTimes(1)
    expect(assignBrowserLocation).toHaveBeenCalledWith("/t/ficc")
    const logged = loggedText(info)
    expect(logged).not.toContain(CUSTOMER_ACCESS_TOKEN)
    expect(logged).not.toContain(CUSTOMER_ID_VALUE)
  })

  it.each([
    { label: "403", outcome: { kind: "status", status: 403 } satisfies Outcome },
    { label: "409", outcome: { kind: "status", status: 409 } satisfies Outcome },
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
