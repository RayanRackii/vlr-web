import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listAdminRentalAssets, fetchAdminScheduleDay, listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { listAdminReservations } from "@/features/rentals/services/reservationsService"
import { listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { AgendaPage } from "./AgendaPage"
import { asset, order, slot } from "./agendaFixtures"

vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: vi.fn() }))
vi.mock("@/features/rentals/services/rentalResourcesService", () => ({ listRentalAssetCategories: vi.fn().mockResolvedValue([]) }))
vi.mock("@/features/catalog/services/catalogService", () => ({ listCatalogProducts: vi.fn().mockResolvedValue([]), listCatalogOrders: vi.fn().mockResolvedValue([]), listCatalogResourceAgenda: vi.fn() }))
vi.mock("@/features/rentals/services/scheduleService", async (original) => ({ ...await original<object>(), listAdminRentalAssets: vi.fn(), fetchAdminScheduleDay: vi.fn(), listOccupancyKinds: vi.fn() }))
vi.mock("@/features/rentals/services/reservationsService", () => ({ listAdminReservations: vi.fn() }))
const grants = ["rentals.assets.read", "rentals.schedule.read", "rentals.reservations.read", "catalog.products.read", "catalog.orders.read"]
function access(permissions = grants, modules = ["rentals", "catalog"]) {
  vi.mocked(usePermissions).mockReturnValue({ activeModules: modules, permissions, can: (p) => permissions.includes(p), isLoading: false, currentUser: null, error: null, refresh: vi.fn() })
}
function setup(search = "visao=dia&date=2026-11-10") {
  return render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter initialEntries={[`/agenda?${search}`]}><AgendaPage /></MemoryRouter></TenantTimeZoneContext.Provider>)
}
beforeEach(() => {
  vi.clearAllMocks()
  access()
  vi.mocked(listAdminRentalAssets).mockResolvedValue([asset, { ...asset, id: "empty", name: "Estúdio B" }])
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [order] })
  vi.mocked(listAdminReservations).mockResolvedValue([])
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: "2026-11-10", slots: [slot({ isInternalUseOrigin: true, owningCatalogOrderId: order.orderId })] })
  vi.mocked(listOccupancyKinds).mockResolvedValue([])
})

it("renders resource hours, an empty row and selection detail below the entire grid with existing links", async () => {
  const user = userEvent.setup()
  const { container } = setup()
  const grid = await screen.findByRole("region", { name: "Grade do dia" })
  expect(within(grid).getByText("06:00")).toBeInTheDocument()
  expect(within(grid).getByText("23:00")).toBeInTheDocument()
  expect(within(screen.getByRole("region", { name: "Estúdio B" })).getByText("Nenhuma atividade com estes filtros.")).toBeInTheDocument()
  const block = within(grid).getByRole("button", { name: /Pedido.*09:00.*12:00.*Podcast/ })
  await user.click(block)
  const detail = screen.getByRole("region", { name: "Detalhes do bloco selecionado" })
  expect(detail).toHaveAttribute("aria-live", "polite")
  expect(grid.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(detail).getByRole("link", { name: "#42" })).toHaveAttribute("href", `/catalogo/pedidos/${order.orderId}`)
  expect(within(detail).getByRole("link", { name: "Podcast" })).toHaveAttribute("href", `/catalogo/produtos/${order.productId}`)
  expect(within(detail).getByRole("link", { name: "Estúdio A" })).toHaveAttribute("href", `/configuracoes/recursos/${asset.id}`)
  expect(container.querySelector("aside, [role=dialog]")).toBeNull()
  await user.click(within(detail).getByRole("button", { name: "Fechar detalhes" }))
  expect(screen.queryByRole("region", { name: "Detalhes do bloco selecionado" })).not.toBeInTheDocument()
  expect(listCatalogResourceAgenda).toHaveBeenCalledWith({ from: "2026-11-10T03:00:00.000Z", to: "2026-11-11T03:00:00.000Z" })
})
