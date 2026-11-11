import { render, screen, waitFor } from "@testing-library/react"
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
    expect(await screen.findByText("PED-12")).toBeInTheDocument()
    expect(screen.getByText("Personalizar caneca")).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("tab", { name: i18n.t("pedidos.tabs.todos") })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("link", { name: i18n.t("catalog.products.title") })).not.toBeInTheDocument()
    expect(screen.queryByText("Nova reserva")).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: i18n.t("pedidos.tabs.pedidos") }))
    expect(screen.getByTestId("location")).toHaveTextContent("aba=pedidos")
    expect(screen.queryByText("Personalizar caneca")).not.toBeInTheDocument()
    const badge = screen.getByText(i18n.t("catalog.status.Requested"))
    expect(badge).not.toHaveClass("w-full", "flex-1")
    await user.click(screen.getByRole("link", { name: /PED-12/ }))
    expect(screen.getByText("Order child")).toBeInTheDocument()
  })
  it.each([
    ["catalog.orders.read", "PED-12", "Personalizar caneca", "solicitacoes"],
    ["catalog.products.read", "Personalizar caneca", "PED-12", "pedidos"],
  ])("only loads and shows permitted data for %s", async (permission, visible, hidden, hiddenTab) => {
    mount([permission], `/pedidos?aba=${hiddenTab}`)
    expect(await screen.findByText(visible)).toBeInTheDocument()
    expect(screen.queryByText(hidden)).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: i18n.t(`pedidos.tabs.${hiddenTab}`) })).not.toBeInTheDocument()
    expect(permission === "catalog.orders.read" ? listProductRequests : listCatalogOrders).not.toHaveBeenCalled()
    expect(screen.getByRole("tab", { name: i18n.t("pedidos.tabs.todos") })).toHaveAttribute("aria-selected", "true")
  })
  it("does not load either source without read access", async () => {
    mount([])
    await waitFor(() => expect(listCatalogOrders).not.toHaveBeenCalled())
    expect(listProductRequests).not.toHaveBeenCalled()
  })
  it("opens a full-page request read from the list fields without an order call", async () => {
    const user = userEvent.setup(); mount(["catalog.products.read"])
    await user.click(await screen.findByRole("link", { name: /Personalizar caneca/ }))
    expect(await screen.findByRole("heading", { level: 1, name: i18n.t("pedidos.requestTitle") })).toBeInTheDocument()
    expect(await screen.findByText("Azul")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(listCatalogOrders).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
  it("keeps readable orders when requests fail and retries the failed load", async () => {
    vi.mocked(listProductRequests).mockRejectedValueOnce(new Error("Request load failed"))
    const user = userEvent.setup(); mount()
    expect(await screen.findByText("PED-12")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Request load failed")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.retry") }))
    expect(await screen.findByText("Personalizar caneca")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
  it("filters statuses with an inline popover and supports keyboard tabs", async () => {
    const user = userEvent.setup(); mount(); await screen.findByText("PED-12")
    await user.click(screen.getByRole("button", { name: `${i18n.t("pedidos.status")} +` }))
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.status.Requested") }))
    expect(screen.queryByRole("link", { name: /Personalizar caneca/ })).not.toBeInTheDocument()
    const allTab = screen.getByRole("tab", { name: i18n.t("pedidos.tabs.todos") })
    allTab.focus(); await user.keyboard("{ArrowRight}")
    expect(screen.getByTestId("location")).toHaveTextContent("aba=pedidos")
    expect(screen.getByRole("tab", { name: i18n.t("pedidos.tabs.pedidos") })).toHaveFocus()
  })
  it("filters by search and clears an empty result inside the card", async () => {
    const user = userEvent.setup(); mount(); await screen.findByText("PED-12")
    await user.type(screen.getByRole("searchbox"), "no-match")
    expect(screen.getByText(i18n.t("pedidos.emptyTitle"))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("pedidos.clear") }))
    expect(screen.getByText("PED-12")).toBeInTheDocument()
  })
})
