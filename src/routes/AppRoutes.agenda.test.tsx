import { render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { getHostTenantSubdomain } from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"
import { AppRoutes } from "./AppRoutes"

vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: () => <div data-testid="staff-layout"><Outlet /></div> }))
vi.mock("@/components/layout/ProtectedRoute", () => ({ ProtectedRoute: () => <Outlet /> }))
vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({ usePlatformTenantSession: () => ({ isPlatformAdmin: false, isInTenantEnvironment: true }) }))
vi.mock("@/features/tenantPortal/components/CustomerAppLayout", () => ({ CustomerAppLayout: () => <Outlet /> }))
vi.mock("@/features/tenantPortal/pages/TenantPortalAgendaPage", () => ({ TenantPortalAgendaPage: () => <h1>Customer agenda</h1> }))
vi.mock("@/features/tenantPortal/services/tenantPortalService", async (original) => ({
  ...await original<typeof import("@/features/tenantPortal/services/tenantPortalService")>(), getHostTenantSubdomain: vi.fn(),
}))
vi.mock("@/features/rentals/services/rentalResourcesService", async (original) => ({
  ...await original<typeof import("@/features/rentals/services/rentalResourcesService")>(), listRentalAssetCategories: vi.fn(async () => []),
}))
vi.mock("@/features/catalog/services/catalogService", async (original) => ({
  ...await original<typeof import("@/features/catalog/services/catalogService")>(), listCatalogProducts: vi.fn(async () => []), listCatalogOrders: vi.fn(async () => []),
}))
function access(modules: string[], permissions: string[]) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: modules, permissions, can: (key) => permissions.includes(key), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function visit(path: string) { render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>) }
beforeEach(() => { vi.mocked(getHostTenantSubdomain).mockReturnValue(null); access(["rentals"], []) })

describe("staff agenda route", () => {
  it.each([
    ["rentals", "rentals.schedule.read"], ["rentals", "rentals.assets.read"], ["rentals", "rentals.reservations.read"],
    ["catalog", "catalog.orders.read"], ["catalog", "catalog.products.read"],
  ])("opens inside MainLayout with %s and only %s", (module, permission) => {
    access([module], [permission])
    visit("/agenda")
    expect(screen.getByTestId("staff-layout")).toContainElement(screen.getByRole("heading", { name: "Visão geral das agendas" }))
  })

  it.each([{ modules: [], permissions: ["rentals.schedule.read"] }, { modules: ["rentals", "catalog"], permissions: [] }])("denies missing module or permission: $modules $permissions", ({ modules, permissions }) => {
    access(modules, permissions)
    visit("/agenda")
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Visão geral das agendas" })).not.toBeInTheDocument()
  })

  it.each([
    { host: null, path: "/t/demo/agenda" }, { host: null, path: "/t/demo/agenda/menu-id" },
    { host: "demo", path: "/agenda" }, { host: "demo", path: "/agenda/menu-id" },
  ])("preserves the customer agenda at $path with host $host", ({ host, path }) => {
    vi.mocked(getHostTenantSubdomain).mockReturnValue(host)
    visit(path)
    expect(screen.getByRole("heading", { name: "Customer agenda" })).toBeInTheDocument()
    expect(screen.queryByTestId("staff-layout")).not.toBeInTheDocument()
  })
})


describe("new staff agenda routes", () => {
  it.each([
    ["/agendas", "rentals", "rentals.assets.read", "Visão geral das agendas"],
    ["/agendas/recursos", "rentals", "rentals.schedule.read", "Agenda de recursos"],
    ["/agendas/produto", "catalog", "catalog.orders.read", "Agenda do produto"],
  ])("opens %s inside staff layout", (path, module, permission, title) => {
    access([module], [permission]); visit(path)
    expect(screen.getByTestId("staff-layout")).toContainElement(screen.getByRole("heading", { level: 1, name: title }))
  })

  it.each([
    ["/agendas", [], ["rentals.schedule.read"]], ["/agendas", ["catalog"], []],
    ["/agendas/recursos", ["catalog"], ["rentals.schedule.read"]], ["/agendas/recursos", ["rentals"], ["rentals.assets.read"]],
    ["/agendas/produto", ["rentals"], ["catalog.orders.read"]], ["/agendas/produto", ["catalog"], ["catalog.products.read"]],
  ] as const)("denies %s without its module or permission", (path, modules, permissions) => {
    access([...modules], [...permissions]); visit(path)
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
  })
})


it.each([
  ["/catalogo/agenda-recursos", "rentals", "rentals.schedule.read", "Agenda de recursos"],
  ["/catalogo/agenda-produto", "catalog", "catalog.orders.read", "Agenda do produto"],
])("redirects the legacy screen at %s", (path, module, permission, title) => {
  access([module], [permission]); visit(path)
  expect(screen.getByTestId("staff-layout")).toContainElement(screen.getByRole("heading", { name: title }))
})
