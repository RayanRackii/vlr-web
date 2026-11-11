import { render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet } from "react-router-dom"
import { expect, it, vi } from "vitest"
import { AppRoutes } from "./AppRoutes"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { pmocManifest } from "@/features/pmoc/manifest"
import { workOrdersManifest } from "@/features/workOrders/manifest"
import i18n from "@/lib/i18n"
vi.mock("@/components/layout/ProtectedRoute", () => ({ ProtectedRoute: () => <Outlet /> }))
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: () => <Outlet /> }))
vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({ usePlatformTenantSession: () => ({ isPlatformAdmin: false, isInTenantEnvironment: false }) }))
vi.mock("@/features/tenantPortal/services/tenantPortalService", async importOriginal => ({ ...await importOriginal<typeof import("@/features/tenantPortal/services/tenantPortalService")>(), getHostTenantSubdomain: () => null }))
vi.mock("@/features/maintenance/MaintenancePage", () => ({ MaintenancePage: () => <h1>Maintenance list</h1> }))
vi.mock("@/features/pmoc/pages/CreatePlanPage", () => ({ CreatePlanPage: ({ maintenance }: { maintenance?: boolean }) => <h1>{maintenance ? "New plan page" : "Legacy plan page"}</h1> }))
vi.mock("@/features/workOrders/pages/CreateWorkOrderPage", () => ({ CreateWorkOrderPage: ({ maintenance }: { maintenance?: boolean }) => <h1>{maintenance ? "New order page" : "Legacy order page"}</h1> }))
function mount(path: string, activeModules: string[], permissions: string[]) {
  return render(<MemoryRouter initialEntries={[path]}><TestPermissionProvider activeModules={activeModules} permissions={permissions}><AppRoutes /></TestPermissionProvider></MemoryRouter>)
}
it.each([
  ["/manutencao", "pmoc", "pmoc.plans.read", "Maintenance list"],
  ["/manutencao", "pmoc", "pmoc.templates.read", "Maintenance list"],
  ["/manutencao", "os", "os.work_orders.read", "Maintenance list"],
  ["/manutencao/planos/novo", "pmoc", "pmoc.plans.write", "New plan page"],
  ["/manutencao/ordens/nova", "os", "os.work_orders.create", "New order page"],
  ["/pmoc/novo", "pmoc", "pmoc.plans.write", "Legacy plan page"],
  ["/os/nova", "os", "os.work_orders.create", "Legacy order page"],
])("renders %s as a full page with %s / %s", (path, module, permission, title) => {
  mount(path, [module], [permission])
  expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument()
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
it.each([
  ["/manutencao", [], ["pmoc.plans.read"]],
  ["/manutencao", ["os"], ["pmoc.plans.read"]],
  ["/manutencao", ["pmoc"], ["os.work_orders.read"]],
  ["/manutencao", ["os", "pmoc"], []],
  ["/manutencao/planos/novo", ["pmoc"], ["pmoc.templates.read"]],
  ["/manutencao/ordens/nova", ["os"], ["os.work_orders.read"]],
  ["/manutencao/ordens/nova?plano=plan-1", ["os"], ["os.work_orders.create"]],
])("blocks %s without paired access", (path, modules, permissions) => {
  mount(path as string, modules as string[], permissions as string[])
  expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
})
it("retains every legacy maintenance destination", () => {
  expect([...pmocManifest.routes.staff, ...workOrdersManifest.routes.staff].map(route => route.path)).toEqual([
    "/pmoc", "/pmoc/biblioteca", "/pmoc/biblioteca/:templateId", "/pmoc/novo", "/pmoc/:id", "/os", "/os/:id", "/os/nova",
  ])
})
