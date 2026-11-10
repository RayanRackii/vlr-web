import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listAdminRentalAssets, fetchAdminScheduleDay, listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { listAdminReservations, type AdminReservation } from "@/features/rentals/services/reservationsService"
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
  const empty = screen.getByRole("region", { name: "Estúdio B" })
  expect(within(empty).getByText("Sem atividades neste dia")).toBeInTheDocument()
  expect(within(empty).getByRole("link", { name: "Criar reserva nesta sala" })).toHaveAttribute("href", "/configuracoes/reservas")
  expect(within(empty).getByRole("link", { name: "Bloquear período" })).toHaveAttribute("href", "/configuracoes/agenda")
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

it("links a reservation to the reservations screen", async () => {
  const user = userEvent.setup()
  const reservation: AdminReservation = {
    id: "33333333-3333-4333-8333-333333333333",
    tenantId: "11111111-1111-4111-8111-111111111111",
    unitId: asset.unitId,
    customerId: "11111111-1111-4111-8111-111111111115",
    customerName: "Marina",
    customerWhatsApp: "",
    startDateTime: "2026-11-10T15:00:00Z",
    endDateTime: "2026-11-10T17:00:00Z",
    status: "Confirmed",
    totalAmount: 0,
    depositPaid: 0,
    createdAt: "2026-11-10T00:00:00.000Z",
    items: [{ id: "33333333-3333-4333-8333-333333333334", assetId: asset.assetId, rentalAssetId: asset.id, assetName: asset.name, quantity: 1, unitPrice: 0, subTotal: 0 }],
  }
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [] })
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: "2026-11-10", slots: [] })
  vi.mocked(listAdminReservations).mockResolvedValue([reservation])
  setup()
  await user.click(await screen.findByRole("button", { name: /Reserva.*12:00.*14:00.*Marina/ }))
  expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/configuracoes/reservas")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("shows a grid skeleton and skips sources the user cannot read", async () => {
  vi.mocked(listAdminRentalAssets).mockReturnValue(new Promise(() => {}))
  const pending = setup()
  expect(screen.getByRole("status", { name: "Carregando a grade do dia…" }).querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Grade do dia" })).not.toBeInTheDocument()
  pending.unmount()

  vi.mocked(listAdminRentalAssets).mockClear()
  vi.mocked(fetchAdminScheduleDay).mockClear()
  vi.mocked(listAdminReservations).mockClear()
  vi.mocked(listCatalogResourceAgenda).mockClear()
  access(["catalog.orders.read"], ["catalog"])
  setup()
  await waitFor(() => expect(listCatalogResourceAgenda).toHaveBeenCalled())
  expect(listAdminRentalAssets).not.toHaveBeenCalled()
  expect(fetchAdminScheduleDay).not.toHaveBeenCalled()
  expect(listAdminReservations).not.toHaveBeenCalled()
})

it("keeps the day grid when one source fails", async () => {
  vi.mocked(listAdminRentalAssets).mockRejectedValue(new Error("down"))
  setup()
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a grade.")
  expect(screen.getByRole("region", { name: "Grade do dia" })).toBeInTheDocument()
})
