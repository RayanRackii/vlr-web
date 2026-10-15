import { act, render, screen, waitFor } from "@testing-library/react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

const STAFF_EMAIL = "admin@clube.com"
const ACCESS_TOKEN = "staff-access-token-secret"
const REFRESH_TOKEN = "staff-refresh-token-secret"

type Listener = (event: AuthChangeEvent, session: Session | null) => void

let listener: Listener | null = null

function staffSession(expiresAt: number): Session {
  return {
    access_token: ACCESS_TOKEN,
    refresh_token: REFRESH_TOKEN,
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      aud: "authenticated",
      email: STAFF_EMAIL,
      phone: "+5511977776666",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-15T00:00:00Z",
    },
  } as Session
}

function UserProbe() {
  const { user, isLoading } = useAuth()
  if (isLoading) {
    return <div>auth-loading</div>
  }
  return <div>user:{user?.id ?? "none"}</div>
}

function renderStaffApp() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <UserProbe />
        <Routes>
          <Route path="/login" element={<div>staff-login</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>staff-dashboard</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function loggedText(spy: { mock: { calls: ReadonlyArray<readonly unknown[]> } }): string {
  return spy.mock.calls.map((call) => String(call[0])).join("\n")
}

describe("AuthContext session events", () => {
  let info: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    listener = null
    info = vi.spyOn(console, "info").mockImplementation(() => {})
    vi.mocked(supabase.auth.signOut).mockClear()
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      listener = callback as Listener
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      } as never
    })
  })

  afterEach(() => {
    info.mockRestore()
  })

  it("sets user null for an initial empty session and ProtectedRoute sends /login", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)

    renderStaffApp()

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(await screen.findByText("staff-login")).toBeInTheDocument()
    expect(screen.queryByText("staff-dashboard")).not.toBeInTheDocument()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("keeps the user when TOKEN_REFRESHED arrives", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 30
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staffSession(expiresAt) },
      error: null,
    } as never)

    renderStaffApp()

    expect(await screen.findByText("user:user-1")).toBeInTheDocument()
    expect(screen.getByText("staff-dashboard")).toBeInTheDocument()

    act(() => {
      listener?.("TOKEN_REFRESHED", staffSession(expiresAt + 3600))
    })

    expect(screen.getByText("user:user-1")).toBeInTheDocument()
    expect(screen.getByText("staff-dashboard")).toBeInTheDocument()
    expect(screen.queryByText("staff-login")).not.toBeInTheDocument()
    const logged = loggedText(info)
    expect(logged).toContain("\"event\":\"TOKEN_REFRESHED\"")
    expect(logged).toContain("\"event\":\"GET_SESSION\"")
    expect(logged).not.toContain(ACCESS_TOKEN)
    expect(logged).not.toContain(REFRESH_TOKEN)
    expect(logged).not.toContain(STAFF_EMAIL)
    expect(logged).not.toContain("+5511977776666")
  })

  it("clears the user on SIGNED_OUT and ProtectedRoute sends /login", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staffSession(Math.floor(Date.now() / 1000) + 60) },
      error: null,
    } as never)

    renderStaffApp()
    expect(await screen.findByText("staff-dashboard")).toBeInTheDocument()

    act(() => {
      listener?.("SIGNED_OUT", null)
    })

    expect(await screen.findByText("staff-login")).toBeInTheDocument()
    expect(screen.getByText("user:none")).toBeInTheDocument()
    expect(screen.queryByText("staff-dashboard")).not.toBeInTheDocument()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it("does not clear the user when a non-SIGNED_OUT event has a null session", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staffSession(Math.floor(Date.now() / 1000) + 60) },
      error: null,
    } as never)

    renderStaffApp()
    expect(await screen.findByText("user:user-1")).toBeInTheDocument()

    act(() => {
      listener?.("INITIAL_SESSION", null)
    })
    act(() => {
      listener?.("TOKEN_REFRESHED", null)
    })

    expect(screen.getByText("user:user-1")).toBeInTheDocument()
    expect(screen.getByText("staff-dashboard")).toBeInTheDocument()
    expect(screen.queryByText("staff-login")).not.toBeInTheDocument()
  })

  it("ignores a stale getSession that resolves after SIGNED_OUT", async () => {
    let resolveSession!: (value: {
      data: { session: Session | null }
      error: null
    }) => void
    const pending = new Promise<{
      data: { session: Session | null }
      error: null
    }>((resolve) => {
      resolveSession = resolve
    })
    vi.mocked(supabase.auth.getSession).mockReturnValue(
      pending as ReturnType<typeof supabase.auth.getSession>,
    )

    renderStaffApp()
    expect(await screen.findByText("auth-loading")).toBeInTheDocument()

    act(() => {
      listener?.("SIGNED_OUT", null)
    })
    expect(await screen.findByText("staff-login")).toBeInTheDocument()

    await act(async () => {
      resolveSession({
        data: { session: staffSession(Math.floor(Date.now() / 1000) + 60) },
        error: null,
      })
    })

    await waitFor(() => {
      expect(screen.getByText("user:none")).toBeInTheDocument()
    })
    expect(screen.getByText("staff-login")).toBeInTheDocument()
    expect(screen.queryByText("staff-dashboard")).not.toBeInTheDocument()
  })
})
