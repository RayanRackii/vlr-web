import { render, screen } from "@testing-library/react"
import { MemoryRouter, Outlet } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { AppRoutes } from "./AppRoutes"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/components/layout/ProtectedRoute", () => ({ ProtectedRoute: () => <Outlet /> }))
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: () => <Outlet /> }))
vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({ usePlatformTenantSession: () => ({ isPlatformAdmin: false, isInTenantEnvironment: false }) }))
vi.mock("@/features/tenantPortal/services/tenantPortalService", async importOriginal => ({
  ...await importOriginal<typeof import("@/features/tenantPortal/services/tenantPortalService")>(), getHostTenantSubdomain: () => null,
}))
vi.mock("@/features/catalog/pages/PedidosPage", () => ({ PedidosPage: () => <h1>Unified orders</h1> }))
vi.mock("@/features/catalog/pages/PedidoRequestDetailPage", () => ({ PedidoRequestDetailPage: () => <h1>Request read</h1> }))
vi.mock("@/features/catalog/pages/CatalogOrderDetailPage", () => ({ CatalogOrderDetailPage: ({ unified }: { unified?: boolean }) => <h1>{unified ? "Unified detail" : "Legacy detail"}</h1> }))
vi.mock("@/features/catalog/pages/CatalogProductsPage", () => ({ CatalogProductsPage: () => <h1>Legacy products</h1> }))
function mount(path: string, activeModules: string[], permissions: string[]) {
  return render(<MemoryRouter initialEntries={[path]}><TestPermissionProvider activeModules={activeModules} permissions={permissions}><AppRoutes /></TestPermissionProvider></MemoryRouter>)
}
describe("Pedidos staff route selection and access", () => {
  it.each([
    ["/pedidos", "catalog.orders.read", "Unified orders"],
    ["/pedidos", "catalog.products.read", "Unified orders"],
    ["/pedidos/order-1", "catalog.orders.read", "Unified detail"],
    ["/pedidos/solicitacoes/request-1", "catalog.products.read", "Request read"],
    ["/catalogo/pedidos", "catalog.orders.read", "Unified orders"],
    ["/catalogo/pedidos/order-1", "catalog.orders.read", "Unified detail"],
    ["/catalogo/solicitacoes", "catalog.products.read", "Unified orders"],
  ])("keeps %s routable with %s", (path, permission, title) => {
    mount(path, ["catalog"], [permission])
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument()
  })
  it.each([
    ["/pedidos", [], ["catalog.orders.read"]],
    ["/pedidos", ["catalog"], []],
    ["/pedidos/order-1", ["catalog"], ["catalog.products.read"]],
    ["/pedidos/solicitacoes/request-1", ["catalog"], ["catalog.orders.read"]],
  ])("blocks %s without its module/permission", (path, modules, permissions) => {
    mount(path as string, modules as string[], permissions as string[])
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
  })
})
