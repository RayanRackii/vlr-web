import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PlatformAdminRoute } from "@/components/layout/PlatformAdminRoute"
import { ProtectedRoute } from "@/components/layout/ProtectedRoute"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import { getCurrentUser } from "@/features/users/services/usersService"
import { supabase } from "@/lib/supabase"

const authState = {
  user: null as { id: string; email: string } | null,
  session: null,
  isLoading: false,
}

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(),
}))

const getCurrentUserMock = vi.mocked(getCurrentUser)

function platformUser(
  overrides: Partial<CurrentUser> = {},
): CurrentUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Pat Admin",
    email: "pat@example.com",
    role: "SUPER_ADMIN",
    tenantId: null,
    activeModules: [],
    activeAssetFamilies: [],
    isTrial: false,
    isTrialReadOnly: false,
    notificationsEmailOnly: false,
    roles: [],
    permissions: [],
    ...overrides,
  }
}

function renderAdminRoutes(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>landing</div>} />
        <Route path="/login" element={<div>login</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>tenant-dashboard</div>} />
          <Route element={<PlatformAdminRoute />}>
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route
              path="/admin/dashboard"
              element={<div>platform-admin-dashboard</div>}
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("platform admin routing", () => {
  beforeEach(() => {
    authState.user = { id: "user-1", email: "pat@example.com" }
    authState.isLoading = false
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "")
    getCurrentUserMock.mockReset()
    vi.mocked(supabase.auth.signOut).mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("redirects /admin to /admin/dashboard for a SUPER_ADMIN", async () => {
    getCurrentUserMock.mockResolvedValue(platformUser({ role: "SUPER_ADMIN" }))

    renderAdminRoutes("/admin")

    expect(
      await screen.findByText("platform-admin-dashboard"),
    ).toBeInTheDocument()
    expect(screen.queryByText("landing")).not.toBeInTheDocument()
  })

  it("lets SUPER_ADMIN access platform admin routes", async () => {
    getCurrentUserMock.mockResolvedValue(
      platformUser({ role: "SUPER_ADMIN", tenantId: null }),
    )

    renderAdminRoutes("/admin/dashboard")

    expect(
      await screen.findByText("platform-admin-dashboard"),
    ).toBeInTheDocument()
  })

  it("sends a tenant Admin (not allowlisted) to /dashboard, not landing or login", async () => {
    authState.user = { id: "user-2", email: "admin@clube.com" }
    getCurrentUserMock.mockResolvedValue(
      platformUser({
        role: "ADMIN",
        email: "admin@clube.com",
        tenantId: "22222222-2222-4222-8222-222222222222",
      }),
    )

    renderAdminRoutes("/admin/dashboard")

    expect(await screen.findByText("tenant-dashboard")).toBeInTheDocument()
    expect(screen.queryByText("landing")).not.toBeInTheDocument()
    expect(screen.queryByText("login")).not.toBeInTheDocument()
    expect(screen.queryByText("platform-admin-dashboard")).not.toBeInTheDocument()
  })

  it("does not call supabase.auth.signOut when getCurrentUser fails", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("unauthorized"))

    renderAdminRoutes("/admin/dashboard")

    await waitFor(() => {
      expect(screen.getByText("tenant-dashboard")).toBeInTheDocument()
    })

    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(screen.queryByText("landing")).not.toBeInTheDocument()
    expect(screen.queryByText("login")).not.toBeInTheDocument()
  })

  it("still allows platform access via the email allowlist when /me fails", async () => {
    vi.stubEnv("VITE_PLATFORM_ADMIN_EMAILS", "pat@example.com")
    getCurrentUserMock.mockRejectedValue(new Error("network"))

    renderAdminRoutes("/admin/dashboard")

    expect(
      await screen.findByText("platform-admin-dashboard"),
    ).toBeInTheDocument()
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })
})
