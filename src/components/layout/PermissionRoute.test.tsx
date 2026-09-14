import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PermissionRoute } from "@/components/layout/PermissionRoute"
import { getCurrentUser } from "@/features/users/services/usersService"
import { PermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-a",
      email: "admin-a@example.com",
      app_metadata: {},
    },
    session: {},
    isLoading: false,
  }),
}))

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({
    isPlatformAdmin: false,
    isInTenantEnvironment: false,
    activeTenantId: null,
    activeTenantLabel: null,
    clearTenantLabel: () => undefined,
  }),
}))

const getCurrentUserMock = vi.mocked(getCurrentUser)

const profile: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Admin A",
  email: "admin-a@example.com",
  role: "ADMIN",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["catalog"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.notifications.read"],
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={["/configuracoes/notificacoes"]}>
      <PermissionProvider>
        <Routes>
          <Route element={<PermissionRoute permission="core.notifications.read" />}>
            <Route
              path="/configuracoes/notificacoes"
              element={<h1>Notificações</h1>}
            />
          </Route>
        </Routes>
      </PermissionProvider>
    </MemoryRouter>,
  )
}

describe("PermissionRoute loading gate", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
  })

  it("G: blocks page content until permissions are loaded", async () => {
    let resolveProfile!: (value: CurrentUser) => void
    getCurrentUserMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve
        }),
    )

    renderRoute()

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Notificações" }),
    ).not.toBeInTheDocument()

    resolveProfile(profile)

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Notificações" }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
