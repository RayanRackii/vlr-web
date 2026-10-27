import { createClient } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...await importOriginal<typeof import("@supabase/supabase-js")>(),
  createClient: vi.fn(),
}))

const KEY = "sb-rolvix-auth-token"

describe("Supabase sign-out storage barrier", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.mocked(createClient).mockReset()
    vi.stubEnv("VITE_SUPABASE_URL", "https://rolvix.example")
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key")
  })

  afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState({}, "", "/")
    vi.unstubAllEnvs()
  })

  it("wires the client to storage that rejects new refresh tokens after Sair", async () => {
    const marker = await import("@/lib/signOutMarker")
    marker.removeSessionKeysAsSignedOut([KEY])
    await vi.importActual("@/lib/supabase")
    const storage = vi.mocked(createClient).mock.calls[0][2]?.auth?.storage
    expect(storage).toBeDefined()

    await storage?.setItem(KEY, "new-refresh-session")
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it("lets the SDK save a legacy recovery hash during construction after Sair", async () => {
    const marker = await import("@/lib/signOutMarker")
    marker.removeSessionKeysAsSignedOut([KEY])
    window.history.replaceState({}, "", "/reset-password#access_token=recovery&refresh_token=recovery-refresh&type=recovery")
    vi.mocked(createClient).mockImplementation((_url, _key, options) => {
      // Supabase saves the hash session before ResetPasswordPage can mount.
      void options?.auth?.storage?.setItem(KEY, "recovery-session")
      return {} as ReturnType<typeof createClient>
    })

    await vi.importActual("@/lib/supabase")
    expect(window.localStorage.getItem(KEY)).toBe("recovery-session")
    expect(marker.isSigningOut()).toBe(false)
  })

  it("keeps the barrier for an incomplete recovery hash", async () => {
    const marker = await import("@/lib/signOutMarker")
    marker.removeSessionKeysAsSignedOut([KEY])
    window.history.replaceState({}, "", "/reset-password#access_token=old-token&type=recovery")
    await vi.importActual("@/lib/supabase")
    const storage = vi.mocked(createClient).mock.calls[0][2]?.auth?.storage

    await storage?.setItem(KEY, "late-refresh-session")
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(marker.isSigningOut()).toBe(true)
  })
})
