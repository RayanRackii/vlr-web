import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardHomeRoute } from "@/components/layout/DashboardHomeRoute"
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
      email: "staff@example.com",
      app_metadata: {},
    },
    session: {},
    isLoading: false,
  }),
}))

const platformSession = {
  isPlatformAdmin: false,
  isInTenantEnvironment: false,
  activeTenantId: null as string | null,
  activeTenantLabel: null as string | null,
  clearTenantLabel: () => undefined,
}

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => platformSession,
}))

const getCurrentUserMock = vi.mocked(getCurrentUser)

const profile: CurrentUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Staff",
  email: "staff@example.com",
  role: "USER",
  tenantId: "22222222-2222-4222-8222-222222222222",
  activeModules: ["rentals"],
  activeAssetFamilies: [],
  isTrial: false,
  isTrialReadOnly: false,
  notificationsEmailOnly: false,
  roles: [],
  permissions: ["core.users.read"],
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <PermissionProvider>
        <Routes>
          <Route element={<DashboardHomeRoute />}>
            <Route path="/dashboard" element={<h1>Painel</h1>} />
          </Route>
          <Route element={<PermissionRoute permission="core.users.read" />}>
            <Route path="/pessoas-e-acesso" element={<h1>Pessoas</h1>} />
          </Route>
          <Route
            element={<PermissionRoute permission="inventory.categories.read" />}
          >
            <Route path="/ativos/categorias" element={<h1>Categorias</h1>} />
          </Route>
        </Routes>
      </PermissionProvider>
    </MemoryRouter>,
  )
}

describe("DashboardHomeRoute", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
    platformSession.isPlatformAdmin = false
    platformSession.isInTenantEnvironment = false
  })

  it("shows the dashboard when the user can read it", async () => {
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      permissions: ["core.dashboard.read"],
    })

    renderHome()

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Acesso negado" })).not.toBeInTheDocument()
  })

  it("lands on the first permitted route when dashboard read is missing", async () => {
    getCurrentUserMock.mockResolvedValue(profile)

    renderHome()

    expect(await screen.findByRole("heading", { name: "Pessoas" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Acesso negado" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Painel" })).not.toBeInTheDocument()
  })

  it("lands on the first allowed child route", async () => {
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      activeModules: ["inventory"],
      permissions: ["inventory.categories.read"],
    })

    renderHome()

    expect(
      await screen.findByRole("heading", { name: "Categorias" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Acesso negado" })).not.toBeInTheDocument()
  })

  it("keeps access denied when nothing is permitted", async () => {
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      activeModules: [],
      permissions: [],
    })

    renderHome()

    expect(
      await screen.findByRole("heading", { name: "Acesso negado" }),
    ).toBeInTheDocument()
  })

  it("keeps the dashboard for a platform admin outside a tenant", async () => {
    platformSession.isPlatformAdmin = true
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      activeModules: [],
      permissions: [],
    })

    renderHome()

    expect(await screen.findByRole("heading", { name: "Painel" })).toBeInTheDocument()
  })
})
