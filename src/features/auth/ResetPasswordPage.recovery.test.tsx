import { act, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import {
  isSigningOut,
  removeSessionKeysAsSignedOut,
  resetSignOutMarkerForTests,
  staffAuthStorage,
} from "@/lib/signOutMarker"
import { supabase } from "@/lib/supabase"

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn<typeof fetch>() }))

vi.mock("@/lib/supabase", async () => {
  const { createClient } = await import("@supabase/supabase-js")
  const { staffAuthStorage } = await import("@/lib/signOutMarker")
  return {
    supabase: createClient("https://recovery.example", "test-anon-key", {
      auth: {
        storage: staffAuthStorage,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: authFetch },
    }),
  }
})

const KEY = "sb-recovery-auth-token"
const user = {
  id: "recovery-user",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-01T00:00:00Z",
}
const accessToken = [
  btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, ""),
  btoa(JSON.stringify({ sub: user.id, exp: 2_000_000_000 })).replace(/=+$/, ""),
  "test-signature",
].join(".")

function AuthState() {
  const { user } = useAuth()
  return <div>{user ? `signed in: ${user.id}` : "signed out"}</div>
}

function renderRecovery() {
  window.history.replaceState({}, "", "/reset-password?token_hash=test-hash&type=recovery")
  render(
    <MemoryRouter>
      <AuthProvider>
        <ResetPasswordPage />
        <AuthState />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  supabase.auth.stopAutoRefresh()
  resetSignOutMarkerForTests()
  window.history.replaceState({}, "", "/")
  authFetch.mockReset()
  vi.restoreAllMocks()
})

describe("ResetPasswordPage recovery after sign-out", () => {
  it("keeps the barrier up during verification and after an invalid token, without writing a session", async () => {
    await supabase.auth.initialize()
    removeSessionKeysAsSignedOut([KEY])
    let resolveVerification!: (response: Response) => void
    const verification = new Promise<Response>((resolve) => { resolveVerification = resolve })
    authFetch.mockReturnValueOnce(verification)
    renderRecovery()

    await waitFor(() => expect(authFetch).toHaveBeenCalled())
    expect(isSigningOut()).toBe(true)
    staffAuthStorage.setItem(KEY, "late-refresh-session")
    expect(window.localStorage.getItem(KEY)).toBeNull()

    await act(async () => {
      resolveVerification(new Response(JSON.stringify({ msg: "Token has expired", error_code: "otp_expired" }), { status: 403 }))
    })

    expect(await screen.findByText("Link inválido ou expirado. Solicite um novo reset na tela de login.")).toBeInTheDocument()
    expect(screen.getByText("signed out")).toBeInTheDocument()
    expect(isSigningOut()).toBe(true)
    staffAuthStorage.setItem(KEY, "another-late-refresh-session")
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect((await supabase.auth.getSession()).data.session).toBeNull()
  })

  it("lifts the barrier and persists a signed-in session after successful verification", async () => {
    await supabase.auth.initialize()
    removeSessionKeysAsSignedOut([KEY])
    authFetch.mockImplementation(async (input) => {
      if (String(input).endsWith("/user")) {
        return new Response(JSON.stringify(user))
      }
      return new Response(JSON.stringify({
        access_token: accessToken,
        refresh_token: "verified-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      }))
    })
    renderRecovery()

    expect(await screen.findByRole("button", { name: "Salvar senha" })).toBeInTheDocument()
    expect(await screen.findByText("signed in: recovery-user")).toBeInTheDocument()
    expect(isSigningOut()).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(KEY)!).access_token).toBe(accessToken)
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe(user.id)
    expect(window.location.search).toBe("")
  })

  it("restores the signed-out state if saving the verified session fails", async () => {
    await supabase.auth.initialize()
    removeSessionKeysAsSignedOut([KEY])
    authFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: accessToken,
        refresh_token: "verified-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Session expired" }), { status: 401 }))
    renderRecovery()

    expect(await screen.findByText("Link inválido ou expirado. Solicite um novo reset na tela de login.")).toBeInTheDocument()
    expect(screen.getByText("signed out")).toBeInTheDocument()
    expect(isSigningOut()).toBe(true)
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect((await supabase.auth.getSession()).data.session).toBeNull()
  })

  it("restores the barrier and shows the error when session storage throws", async () => {
    await supabase.auth.initialize()
    removeSessionKeysAsSignedOut([KEY])
    const setItem = staffAuthStorage.setItem.bind(staffAuthStorage)
    vi.spyOn(staffAuthStorage, "setItem").mockImplementation((key, value) => {
      if (key === KEY && !isSigningOut()) {
        throw new DOMException("Storage full", "QuotaExceededError")
      }
      setItem(key, value)
    })
    authFetch.mockImplementation(async (input) => new Response(JSON.stringify(
      String(input).endsWith("/user") ? user : {
        access_token: accessToken,
        refresh_token: "verified-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      },
    )))
    renderRecovery()

    expect(await screen.findByText("Link inválido ou expirado. Solicite um novo reset na tela de login.")).toBeInTheDocument()
    expect(screen.getByText("signed out")).toBeInTheDocument()
    expect(isSigningOut()).toBe(true)
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})
