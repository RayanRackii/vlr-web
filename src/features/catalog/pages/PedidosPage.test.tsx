import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { CatalogOrder, ProductRequest } from "../schemas/catalogSchemas"
import { PedidoRequestDetailPage } from "./PedidoRequestDetailPage"
import { PedidosPage } from "./PedidosPage"
import { listCatalogOrders, listProductRequests } from "../services/catalogService"
import i18n from "@/lib/i18n"

vi.mock("../services/catalogService", () => ({ listCatalogOrders: vi.fn(), listProductRequests: vi.fn() }))
const order: CatalogOrder = { id: "order-1", displayNumber: "PED-12", orderNumber: 12, status: "Requested", customerName: "Ana", totalAmount: 15, currency: "BRL", createdAt: "2026-11-01T12:00:00Z", items: [], history: [], customerId: "customer-1", customerEmail: null, customerPhone: null, customerNote: null, rejectedReason: null, cancelledReason: null, orderVersion: "0", planningRevision: 0, productionSummary: "NotRequired", estimatedReadyAt: null }
const request: ProductRequest = { id: "request-1", customerId: "customer-1", description: "Personalizar caneca", quantity: 2, note: "Azul", status: "Submitted", createdAt: "2026-11-02T12:00:00Z", files: [] }
function tab(key: string): HTMLElement
function tab(key: string, mode: "get"): HTMLElement
function tab(key: string, mode: "query"): HTMLElement | null
function tab(key: string, mode: "get" | "query" = "get") {
  const group = within(screen.getByRole("group", { name: i18n.t("pedidos.type") }))
  const options = { name: new RegExp(i18n.t(key)) }
  return mode === "get" ? group.getByRole("button", options) : group.queryByRole("button", options)
}
function Location() { return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output> }
function mount(permissions = ["catalog.orders.read", "catalog.products.read"], entry = "/pedidos") {
  return render(<MemoryRouter initialEntries={[entry]}><TestPermissionProvider permissions={permissions} activeModules={["catalog"]}>
    <Routes><Route path="/pedidos" element={<PedidosPage />} /><Route path="/pedidos/solicitacoes/:requestId" element={<PedidoRequestDetailPage />} /><Route path="/pedidos/:orderId" element={<p>Order child</p>} /></Routes><Location />
  </TestPermissionProvider></MemoryRouter>)
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listCatalogOrders).mockResolvedValue([order]); vi.mocked(listProductRequests).mockResolvedValue([request]) })
describe("unified Pedidos", () => {
  it("defaults to Todos, has one H1, and writes the selected tab into aba", async () => {
    const user = userEvent.setup(); mount()
    expect((await screen.findAllByText("PED-12")).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Personalizar caneca").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(tab("pedidos.tabs.todos", "get")).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("link", { name: i18n.t("catalog.products.title") })).not.toBeInTheDocument()
    expect(screen.queryByText("Nova reserva")).not.toBeInTheDocument()
    await user.click(tab("pedidos.tabs.pedidos", "get"))
    expect(screen.getByTestId("location")).toHaveTextContent("aba=pedidos")
    expect(screen.queryAllByText("Personalizar caneca")).toHaveLength(0)
    const table = screen.getByRole("table", { name: i18n.t("nav.pedidos") })
    const badge = within(table).getByText(i18n.t("catalog.status.Requested"))
    expect(badge.closest("[data-status-tone]")).toHaveAttribute("data-status-tone", "warning")
    expect(badge).not.toHaveClass("w-full", "flex-1")
    await user.click(within(table).getByRole("link", { name: /PED-12/ }))
    expect(screen.getByText("Order child")).toBeInTheDocument()
  })
  it.each([
    ["catalog.orders.read", "PED-12", "Personalizar caneca", "solicitacoes"],
    ["catalog.products.read", "Personalizar caneca", "PED-12", "pedidos"],
  ])("only loads and shows permitted data for %s", async (permission, visible, hidden, hiddenTab) => {
    mount([permission], `/pedidos?aba=${hiddenTab}`)
    expect((await screen.findAllByText(visible)).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(hidden)).toHaveLength(0)
    expect(tab(`pedidos.tabs.${hiddenTab}`, "query")).not.toBeInTheDocument()
    expect(permission === "catalog.orders.read" ? listProductRequests : listCatalogOrders).not.toHaveBeenCalled()
    expect(tab("pedidos.tabs.todos", "get")).toHaveAttribute("aria-pressed", "true")
  })
  it("does not load either source without read access", async () => {
    mount([])
    await waitFor(() => expect(listCatalogOrders).not.toHaveBeenCalled())
    expect(listProductRequests).not.toHaveBeenCalled()
  })
  it("opens a full-page request read from the list fields without an order call", async () => {
    const user = userEvent.setup(); mount(["catalog.products.read"])
    await user.click(within(await screen.findByRole("table")).getByRole("link", { name: /Personalizar caneca/ }))
    expect(await screen.findByRole("heading", { level: 1, name: i18n.t("pedidos.requestTitle") })).toBeInTheDocument()
    expect(await screen.findByText("Azul")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(listCatalogOrders).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
  it("keeps readable orders when requests fail and retries the failed load", async () => {
    vi.mocked(listProductRequests).mockRejectedValueOnce(new Error("Request load failed"))
    const user = userEvent.setup(); mount()
    expect((await screen.findAllByText("PED-12")).length).toBeGreaterThan(0)
    expect(screen.getByRole("alert")).toHaveTextContent("Request load failed")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.retry") }))
    expect((await screen.findAllByText("Personalizar caneca")).length).toBeGreaterThan(0)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
  it("renders the columns, row links and a card list below md", async () => {
    mount(); await screen.findAllByText("PED-12")
    const table = screen.getByRole("table", { name: i18n.t("nav.pedidos") })
    expect(within(table).getAllByRole("columnheader").map(h => h.textContent)).toEqual([
      i18n.t("pedidos.columns.order"), i18n.t("pedidos.columns.customer"), i18n.t("pedidos.columns.total"), i18n.t("pedidos.columns.date"), i18n.t("pedidos.status"),
    ])
    const orderRow = within(table).getByText("PED-12").closest("tr")!
    expect(within(orderRow).getByText("Ana")).toBeInTheDocument()
    expect(within(orderRow).getByRole("link", { name: "PED-12" })).toHaveAttribute("href", "/pedidos/order-1")
    expect(within(table).getByRole("link", { name: /Personalizar caneca/ })).toHaveAttribute("href", "/pedidos/solicitacoes/request-1")
    const cards = screen.getByRole("list", { name: i18n.t("nav.pedidos") })
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2)
    expect(within(cards).getByRole("link", { name: "PED-12" })).toHaveAttribute("href", "/pedidos/order-1")
    expect(screen.queryByText(i18n.t("pedidos.eyebrow"))).not.toBeInTheDocument()
  })
  it("filters statuses with chips (counts from the current tab) and keeps tabs in the URL", async () => {
    const user = userEvent.setup(); mount(); await screen.findAllByText("PED-12")
    const group = screen.getByRole("group", { name: i18n.t("pedidos.status") })
    expect(within(group).getByRole("button", { name: new RegExp(`${i18n.t("pedidos.allStatuses")}.*2`) })).toBeInTheDocument()
    await user.click(within(group).getByRole("button", { name: new RegExp(i18n.t("catalog.status.Requested")) }))
    const table = screen.getByRole("table", { name: i18n.t("nav.pedidos") })
    expect(within(table).queryByRole("link", { name: /Personalizar caneca/ })).not.toBeInTheDocument()
    expect(within(table).getByRole("link", { name: /PED-12/ })).toBeInTheDocument()
    await user.click(tab("pedidos.tabs.solicitacoes", "get"))
    expect(screen.getByTestId("location")).toHaveTextContent("aba=solicitacoes")
    expect(screen.getAllByRole("link", { name: /Personalizar caneca/ }).length).toBeGreaterThan(0)
    const requestGroup = screen.getByRole("group", { name: i18n.t("pedidos.status") })
    expect(within(requestGroup).queryByRole("button", { name: new RegExp(i18n.t("catalog.status.Requested")) })).not.toBeInTheDocument()
  })
  it("shows 25 rows, loads 25 more on demand and resets when the filter changes", async () => {
    const user = userEvent.setup()
    vi.mocked(listCatalogOrders).mockResolvedValue(Array.from({ length: 30 }, (_, index) => ({ ...order, id: `order-${index}`, displayNumber: `PED-${100 + index}`, createdAt: `2026-10-${String(index + 1).padStart(2, "0")}T12:00:00Z` })))
    vi.mocked(listProductRequests).mockResolvedValue([])
    mount(["catalog.orders.read"]); await screen.findAllByText("PED-129")
    const table = () => screen.getByRole("table", { name: i18n.t("nav.pedidos") })
    expect(within(table()).getAllByRole("row")).toHaveLength(26)
    expect(screen.getByText(i18n.t("pedidos.showing", { shown: 25, total: 30 }))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("pedidos.loadMore") }))
    expect(within(table()).getAllByRole("row")).toHaveLength(31)
    expect(screen.getByText(i18n.t("pedidos.showing", { shown: 30, total: 30 }))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("pedidos.loadMore") })).not.toBeInTheDocument()
    await user.type(screen.getByRole("searchbox"), "PED-1")
    expect(within(table()).getAllByRole("row")).toHaveLength(26)
    expect(screen.getByRole("button", { name: i18n.t("pedidos.loadMore") })).toBeInTheDocument()
  })
  it("filters by search and clears an empty result inside the card", async () => {
    const user = userEvent.setup(); mount(); await screen.findAllByText("PED-12")
    await user.type(screen.getByRole("searchbox"), "no-match")
    expect(screen.getByText(i18n.t("pedidos.emptyTitle"))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("pedidos.clear") }))
    expect(screen.getAllByText("PED-12").length).toBeGreaterThan(0)
  })
  it("shows the customer name in the list and name plus e-mail in the request detail", async () => {
    vi.mocked(listProductRequests).mockResolvedValue([{ ...request, customerName: "Beatriz", customerEmail: "bia@example.com" }])
    mount()
    const table = await screen.findByRole("table")
    expect(within(table).getByText("Beatriz")).toBeInTheDocument()
  })
  it("request detail shows name and e-mail, only the name, or a dash, never the id", async () => {
    vi.mocked(listProductRequests).mockResolvedValue([{ ...request, customerName: "Beatriz", customerEmail: "bia@example.com" }])
    const view = mount(["catalog.products.read"], "/pedidos/solicitacoes/request-1")
    expect(await screen.findByText(/Beatriz/)).toHaveTextContent("Beatriz · bia@example.com")
    expect(screen.queryByText("customer-1")).not.toBeInTheDocument()
    view.unmount()
    vi.mocked(listProductRequests).mockResolvedValue([{ ...request, customerName: null, customerEmail: null }])
    mount(["catalog.products.read"], "/pedidos/solicitacoes/request-1")
    const label = await screen.findByText(i18n.t("pedidos.customer"))
    expect(label.nextElementSibling).toHaveTextContent(/^—$/)
  })
  it("request detail never shows the customer id", async () => {
    mount(["catalog.products.read"], "/pedidos/solicitacoes/request-1")
    expect((await screen.findAllByText("Personalizar caneca")).length).toBeGreaterThan(0)
    expect(screen.queryByText("customer-1")).not.toBeInTheDocument()
  })
})
