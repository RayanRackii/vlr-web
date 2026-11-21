import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

  it("denies the notifications route when the permission is missing", async () => {
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      permissions: ["core.dashboard.read"],
    })

    renderRoute()

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Notificações" }),
    ).not.toBeInTheDocument()
  })

  it("shows a retryable error, not access denied, after a network /me failure", async () => {
    getCurrentUserMock.mockRejectedValueOnce(new Error("network"))
    getCurrentUserMock.mockResolvedValueOnce(profile)

    renderRoute()

    expect(
      await screen.findByRole("heading", { name: "Não foi possível carregar seu acesso" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Acesso negado" })).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Notificações" }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    expect(await screen.findByRole("heading", { name: "Notificações" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Não foi possível carregar seu acesso" }),
    ).not.toBeInTheDocument()
    expect(getCurrentUserMock).toHaveBeenLastCalledWith({ force: true })
  })

  it("keeps the deny flow when /me answers 401", async () => {
    getCurrentUserMock.mockRejectedValue(
      Object.assign(new Error("unauthorized"), { status: 401 }),
    )

    renderRoute()

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Não foi possível carregar seu acesso" }),
    ).not.toBeInTheDocument()
  })
})

describe("PermissionRoute PMOC coverage gate", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset()
  })

  it("R: Technician without pmoc.plans.read is denied /pmoc/:id", async () => {
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      role: "TECHNICIAN",
      permissions: ["os.work_orders.read", "os.work_orders.execute"],
      activeModules: ["os", "pmoc"],
    })

    render(
      <MemoryRouter initialEntries={["/pmoc/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]}>
        <PermissionProvider>
          <Routes>
            <Route element={<PermissionRoute permission="pmoc.plans.read" />}>
              <Route path="/pmoc/:id" element={<h1>Plan detail</h1>} />
            </Route>
          </Routes>
        </PermissionProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: "Acesso negado" })).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Plan detail" }),
    ).not.toBeInTheDocument()
  })

  it("shows the module-inactive page, not access denied, when the module is off", async () => {
    getCurrentUserMock.mockResolvedValue({
      ...profile,
      permissions: ["rentals.assets.read", "core.units.read"],
      activeModules: ["catalog"],
    })

    render(
      <MemoryRouter initialEntries={["/configuracoes/recursos"]}>
        <PermissionProvider>
          <Routes>
            <Route element={<PermissionRoute permissions={["rentals.assets.read"]} modules={["rentals"]} />}>
              <Route path="/configuracoes/recursos" element={<h1>Recursos</h1>} />
            </Route>
          </Routes>
        </PermissionProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole("heading", { name: "Este módulo não está ativo para esta empresa" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Acesso negado" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Recursos" })).not.toBeInTheDocument()
  })
})
