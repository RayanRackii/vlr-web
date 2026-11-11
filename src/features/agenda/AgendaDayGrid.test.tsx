import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listAdminRentalAssets, fetchAdminScheduleDay, listOccupancyKinds } from "@/features/rentals/services/scheduleService"
import { listAdminReservations, type AdminReservation } from "@/features/rentals/services/reservationsService"
import { listCatalogOrders, listCatalogResourceAgenda } from "@/features/catalog/services/catalogService"
import { catalogOrderSchema } from "@/features/catalog/schemas/catalogSchemas"
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
function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}
function setup(search = "visao=dia&date=2026-11-10") {
  return render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><MemoryRouter initialEntries={[`/agenda?${search}`]}><AgendaPage /><Search /></MemoryRouter></TenantTimeZoneContext.Provider>)
}
function stubNarrow() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(max-width: 639px)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}
afterEach(() => {
  vi.unstubAllGlobals()
})
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
  expect(within(empty).getByRole("link", { name: "Criar reserva neste recurso" })).toHaveAttribute("href", "/configuracoes/reservas")
  expect(within(empty).getByRole("link", { name: "Bloquear período" })).toHaveAttribute("href", "/configuracoes/agenda")
  const block = within(grid).getByRole("button", { name: /Pedido.*09:00.*12:00.*Podcast/ })
  expect(block).toHaveClass("text-sm")
  expect(block).toHaveAttribute("title", expect.stringMatching(/Podcast/))
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
  expect(listAdminReservations).toHaveBeenCalledWith({ from: "2026-11-10", to: "2026-11-10" })
  expect(listCatalogOrders).toHaveBeenCalledWith()
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

it("keeps the other sources when reservations return 400", async () => {
  vi.mocked(listAdminReservations).mockRejectedValue(new Error("400"))
  setup()
  expect(await screen.findByRole("button", { name: /Pedido.*09:00.*12:00.*Podcast/ })).toBeInTheDocument()
  expect(screen.queryByText("Recursos não entrou nesta grade.")).not.toBeInTheDocument()
  expect(screen.getByText("Não foi possível carregar as reservas; o restante da agenda está atualizado.")).toHaveClass("text-muted-foreground")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByRole("region", { name: "Grade do dia" })).toBeInTheDocument()
  expect(listAdminReservations).toHaveBeenCalledWith({ from: "2026-11-10", to: "2026-11-10" })
})

it("opens the clicked week day and keeps the chips", async () => {
  const user = userEvent.setup()
  setup("visao=semana&date=2026-11-10&tipo=pedido")
  const week = await screen.findByRole("region", { name: "Grade da semana" })
  expect(within(week).getAllByText("Livre").length).toBeGreaterThan(0)
  expect(listCatalogResourceAgenda).toHaveBeenCalledWith({
    from: "2026-11-09T03:00:00.000Z",
    to: "2026-11-16T03:00:00.000Z",
  })
  expect(listAdminReservations).toHaveBeenCalledWith({ from: "2026-11-09", to: "2026-11-15" })
  for (const date of ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]) {
    expect(fetchAdminScheduleDay).toHaveBeenCalledWith(date)
  }
  await user.click(screen.getByRole("button", { name: /Estúdio A 2026-11-10 1 Pedido/ }))
  const params = new URLSearchParams(screen.getByTestId("search").textContent ?? "")
  expect(params.get("visao")).toBe("dia")
  expect(params.get("date")).toBe("2026-11-10")
  expect(params.get("tipo")).toBe("pedido")
})

it("lists the day by resource on a narrow screen and keeps the detail below that resource", async () => {
  const user = userEvent.setup()
  stubNarrow()
  setup()
  const grid = await screen.findByRole("region", { name: "Grade do dia" })
  expect(grid.className).not.toContain("overflow-x-auto")
  expect(within(grid).queryByText("06:00")).not.toBeInTheDocument()
  expect(screen.getByRole("group", { name: "Tipo" }).querySelector(".flex-wrap")).toBeTruthy()
  const resource = screen.getByRole("region", { name: "Estúdio A" })
  await user.click(within(resource).getByRole("button", { name: /Pedido.*09:00.*12:00.*Podcast/ }))
  const detail = screen.getByRole("region", { name: "Detalhes do bloco selecionado" })
  expect(resource.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(grid.contains(detail)).toBe(true)
})

it("does not overlap a full-day axis or draw 24:00", async () => {
  vi.mocked(listAdminRentalAssets).mockResolvedValue([{ ...asset, openTime: "00:00:00", closeTime: "24:00:00" }])
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [] })
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: "2026-11-10", slots: [] })
  setup()
  const grid = await screen.findByRole("region", { name: "Grade do dia" })
  expect(within(grid).getByText("00:00")).toBeInTheDocument()
  expect(within(grid).queryByText("24:00")).not.toBeInTheDocument()
  expect(within(grid).queryByText("01:00")).not.toBeInTheDocument()
})

it("titles an order with the product and the translated status, not the raw slot label", async () => {
  const user = userEvent.setup()
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({
    resources: [],
    items: [{ ...order, occupiedStart: null, occupiedEnd: null, workStart: null, workEnd: null, productName: "Podcast", orderStatus: "Approved" }],
  })
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
    date: "2026-11-10",
    slots: [slot({ isInternalUseOrigin: true, owningCatalogOrderId: order.orderId, occupancyKindKey: "open", occupancyKindLabel: "Open", label: "Open", startTime: "00:00:00", endTime: "23:59:00" })],
  })
  setup()
  await user.click(await screen.findByRole("button", { name: /Pedido.*Podcast/ }))
  const detail = screen.getByRole("region", { name: "Detalhes do bloco selecionado" })
  expect(within(detail).getByRole("heading", { name: "Podcast" })).toBeInTheDocument()
  expect(within(detail).getByText("Aprovado")).toBeInTheDocument()
  expect(within(detail).queryByText("Open")).not.toBeInTheDocument()
  expect(within(detail).queryByText("Approved")).not.toBeInTheDocument()
  const time = within(detail).getByText("00:00 – 23:59")
  expect(time).toHaveClass("text-foreground")
  expect(time.className).not.toMatch(/line-through|text-muted-foreground/)
})

it("links an order that has no display number by its short id", async () => {
  const user = userEvent.setup()
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [{ ...order, displayNumber: null }] })
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({ date: "2026-11-10", slots: [] })
  setup()
  await user.click(await screen.findByRole("button", { name: /Pedido.*Podcast/ }))
  expect(screen.getByRole("link", { name: order.orderId.slice(0, 8) })).toHaveAttribute("href", `/catalogo/pedidos/${order.orderId}`)
})

it("uses the order list number and the customer when the grid block has neither", async () => {
  const user = userEvent.setup()
  vi.mocked(listCatalogOrders).mockResolvedValue([catalogOrderSchema.parse({
    id: order.orderId,
    displayNumber: "#22",
    orderNumber: 22,
    status: "Requested",
    customerId: "11111111-1111-4111-8111-111111111115",
    customerName: "Marina",
    customerEmail: null,
    customerPhone: null,
    customerNote: null,
    totalAmount: null,
    currency: "BRL",
    rejectedReason: null,
    cancelledReason: null,
    createdAt: "2026-11-10T12:00:00Z",
    items: [],
    history: [],
  })])
  vi.mocked(listCatalogResourceAgenda).mockResolvedValue({ resources: [], items: [] })
  vi.mocked(fetchAdminScheduleDay).mockResolvedValue({
    date: "2026-11-10",
    slots: [slot({ isInternalUseOrigin: true, owningCatalogOrderId: order.orderId, occupancyKindKey: "open", occupancyKindLabel: "Open", label: "Open", customerName: null })],
  })
  setup()
  const block = await screen.findByRole("button", { name: /Pedido #22/ })
  expect(block).toHaveTextContent("Pedido #22 · Marina")
  expect(block).not.toHaveTextContent(order.orderId.slice(0, 8))
  await user.click(block)
  const detail = screen.getByRole("region", { name: "Detalhes do bloco selecionado" })
  expect(within(detail).getByRole("link", { name: "#22" })).toHaveAttribute("href", `/catalogo/pedidos/${order.orderId}`)
  expect(within(detail).getByText("Marina")).toBeInTheDocument()
})

it("uses the day list at a 400px viewport before the column is measured", async () => {
  const previous = window.innerWidth
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 })
  try {
    setup()
    const grid = await screen.findByRole("region", { name: "Grade do dia" })
    expect(grid.className).not.toContain("overflow-x-auto")
    expect(within(grid).queryByText("06:00")).not.toBeInTheDocument()
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: previous })
  }
})

it("uses the day list when the agenda column is 512px on a wide viewport", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    media: "",
    addEventListener: () => {},
    removeEventListener: () => {},
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  vi.stubGlobal("ResizeObserver", class {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) { this.callback = callback }
    observe(target: Element) {
      this.callback([{ contentRect: { width: 512 } } as ResizeObserverEntry], this)
      void target
    }
    unobserve() {}
    disconnect() {}
  })
  setup()
  await waitFor(() => expect(screen.getByRole("region", { name: "Grade do dia" }).className).not.toContain("overflow-x-auto"))
  const grid = screen.getByRole("region", { name: "Grade do dia" })
  expect(within(grid).queryByText("06:00")).not.toBeInTheDocument()
  const links = within(screen.getByRole("region", { name: "Estúdio B" })).getByRole("link", { name: "Bloquear período" }).parentElement
  expect(links?.className).toContain("flex-wrap")
})

it("keeps the week when one schedule day fails and does not blame occupancy types", async () => {
  vi.mocked(fetchAdminScheduleDay).mockImplementation(async (date: string) => {
    if (date === "2026-11-12") throw new Error("500")
    return { date, slots: [] }
  })
  setup("visao=semana&date=2026-11-10")
  expect(await screen.findByRole("button", { name: /Estúdio A 2026-11-10 1 Pedido/ })).toBeInTheDocument()
  expect(screen.getByText("Não foi possível carregar horários; o restante da agenda está atualizado.")).toBeInTheDocument()
  expect(screen.queryByText("Não foi possível carregar os tipos de ocupação; o restante da agenda está atualizado.")).not.toBeInTheDocument()
})

it("names occupancy types when that list fails and still shows the week", async () => {
  vi.mocked(listOccupancyKinds).mockRejectedValue(new Error("400"))
  setup("visao=semana&date=2026-11-10")
  expect(await screen.findByRole("button", { name: /Estúdio A 2026-11-10 1 Pedido/ })).toBeInTheDocument()
  expect(screen.getByText("Não foi possível carregar os tipos de ocupação; o restante da agenda está atualizado.")).toBeInTheDocument()
  expect(screen.queryByText("Não foi possível carregar horários; o restante da agenda está atualizado.")).not.toBeInTheDocument()
})
