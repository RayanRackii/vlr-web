import { act, render, screen, waitFor } from "@testing-library/react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import {
  getCustomerAccessToken,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"
import { noteStaffSignIn } from "@/lib/api"
import {
  hasActiveStaffSession,
  resetSessionRestoreGuardForTests,
  SERVER_SIGN_OUT_TIMEOUT_MS,
  signOutCustomerPortal,
  signOutStaffPortal,
} from "@/lib/sessionRestoreGuard"
import { purgeSignedOutSessions, staffAuthStorage } from "@/lib/signOutMarker"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/browserLocation", () => ({
  assignBrowserLocation: vi.fn(),
  replaceBrowserLocation: vi.fn(),
}))

const KEY = "sb-rolvix-auth-token"

function storedValue(token: string): string {
  return JSON.stringify({ access_token: token, refresh_token: "r-" + token, expires_at: 1_900_000_000 })
}

function session(token: string): Session {
  return {
    access_token: token,
    refresh_token: "r-" + token,
    expires_at: 1_900_000_000,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "u1", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" },
  } as Session
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Probe() {
  const { user, isLoading } = useAuth()
  return <div>{isLoading ? "loading" : `user:${user?.id ?? "none"}`}</div>
}

describe("Sair reload race", () => {
  beforeEach(() => {
    resetSessionRestoreGuardForTests()
    window.localStorage.setItem(KEY, storedValue("staff-a"))
  })

  afterEach(() => {
    vi.useRealTimers()
    resetSessionRestoreGuardForTests()
    window.localStorage.clear()
    vi.mocked(supabase.auth.admin.signOut).mockReset().mockResolvedValue({ data: null, error: null } as never)
    vi.mocked(supabase.auth.signOut).mockReset().mockResolvedValue({ error: null } as never)
    vi.mocked(supabase.auth.getSession).mockReset().mockResolvedValue({ data: { session: null }, error: null } as never)
  })

  it("(a) clears the stored staff session before the server sign-out resolves", async () => {
    const server = deferred<{ data: null; error: null }>()
    vi.mocked(supabase.auth.admin.signOut).mockReturnValue(server.promise as never)

    const pending = signOutStaffPortal()

    // Still waiting on the network: a reload now must find nothing to restore.
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(hasActiveStaffSession()).toBe(false)
    expect(supabase.auth.stopAutoRefresh).toHaveBeenCalled()

    server.resolve({ data: null, error: null })
    await expect(pending).resolves.toBe(true)
    expect(supabase.auth.admin.signOut).toHaveBeenCalledWith("staff-a", "global")
  })

  it("(a) clears the customer token synchronously", () => {
    window.localStorage.removeItem(KEY)
    persistCustomerSession("customer-token", "acme")
    signOutCustomerPortal("acme")
    expect(getCustomerAccessToken()).toBeNull()
  })

  it("(b) a reload while sign-out is pending does not restore the session, even if a late save re-writes it", async () => {
    const server = deferred<{ data: null; error: null }>()
    vi.mocked(supabase.auth.admin.signOut).mockReturnValue(server.promise as never)
    void signOutStaffPortal()

    // An in-flight save in the auth client re-writes the same session after Sair.
    window.localStorage.setItem(KEY, storedValue("staff-a"))
    // Reload: the boot purge runs before the auth client reads storage.
    expect(purgeSignedOutSessions()).toBe(true)
    expect(window.localStorage.getItem(KEY)).toBeNull()

    server.reject(new Error("offline"))
  })

  it("(b) hydrate during sign-out renders signed out, not a restoring skeleton", async () => {
    const server = deferred<{ data: null; error: null }>()
    vi.mocked(supabase.auth.admin.signOut).mockReturnValue(server.promise as never)
    let listener: ((event: AuthChangeEvent, s: Session | null) => void) | null = null
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
      listener = cb as typeof listener
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never
    })
    void signOutStaffPortal()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: session("staff-a") }, error: null } as never)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByText("user:none")).toBeInTheDocument())

    // A refresh that was already in flight lands after Sair: ignored and purged.
    staffAuthStorage.setItem(KEY, storedValue("refreshed-after-logout"))
    act(() => listener?.("TOKEN_REFRESHED", session("refreshed-after-logout")))
    expect(screen.getByText("user:none")).toBeInTheDocument()
    expect(window.localStorage.getItem(KEY)).toBeNull()

    server.reject(new Error("offline"))
  })

  it("(b) a new login after Sair can save its session and survive reload", async () => {
    await signOutStaffPortal()
    noteStaffSignIn()
    staffAuthStorage.setItem(KEY, storedValue("staff-b"))
    expect(purgeSignedOutSessions()).toBe(false)
    expect(hasActiveStaffSession()).toBe(true)

    vi.resetModules()
    const reloaded = await import("@/lib/signOutMarker")
    expect(reloaded.isSigningOut()).toBe(false)
    expect(reloaded.staffAuthStorage.getItem(KEY)).toBe(storedValue("staff-b"))
  })

  it("rejects a late refresh with a new token before and after reload", async () => {
    await signOutStaffPortal()
    staffAuthStorage.setItem(KEY, storedValue("refreshed-after-logout"))
    expect(window.localStorage.getItem(KEY)).toBeNull()
    staffAuthStorage.setItem("unrelated-preference", "kept")
    expect(window.localStorage.getItem("unrelated-preference")).toBe("kept")

    vi.resetModules()
    const reloaded = await import("@/lib/signOutMarker")
    reloaded.staffAuthStorage.setItem(KEY, storedValue("another-refresh"))
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(reloaded.staffAuthStorage.getItem(KEY)).toBeNull()
  })

  it("stores only a bounded sign-out flag and timestamp, without session credentials", async () => {
    await signOutStaffPortal()
    const marker = JSON.parse(window.sessionStorage.getItem("rolvix:signed-out-sessions") ?? "null")
    expect(marker).toEqual({ signingOut: true, at: expect.any(Number) })
    await signOutStaffPortal()
    expect(JSON.parse(window.sessionStorage.getItem("rolvix:signed-out-sessions") ?? "null"))
      .toEqual({ signingOut: true, at: expect.any(Number) })
  })

  it("keeps a different token from a late refresh signed out after final cleanup and reload", async () => {
    await signOutStaffPortal()

    // The refresh completes after both sign-out operations and their final cleanup.
    window.localStorage.setItem(KEY, storedValue("refreshed-after-logout"))

    vi.resetModules()
    const reloaded = await import("@/lib/signOutMarker")
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(reloaded.isSigningOut()).toBe(true)
  })

  it("(c) a failed or hanging server sign-out still ends the local session within the bound", async () => {
    vi.useFakeTimers()
    vi.mocked(supabase.auth.admin.signOut).mockReturnValue(new Promise(() => {}) as never)
    vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error("lock timeout"))

    const pending = signOutStaffPortal()
    await vi.advanceTimersByTimeAsync(SERVER_SIGN_OUT_TIMEOUT_MS + 1)

    await expect(pending).resolves.toBe(true)
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(hasActiveStaffSession()).toBe(false)
  })
})
