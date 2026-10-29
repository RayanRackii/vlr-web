import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CatalogOrderDetailPage } from "./CatalogOrderDetailPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getCatalogOrder, listCatalogProducts, rejectCatalogOrder, cancelCatalogOrder } from "../services/catalogService"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("../services/catalogService", () => ({
  getCatalogOrder: vi.fn(), listCatalogProducts: vi.fn(), rejectCatalogOrder: vi.fn(),
  cancelCatalogOrder: vi.fn(), approveCatalogOrder: vi.fn(), completeCatalogOrder: vi.fn(),
  markCatalogOrderReady: vi.fn(), startPreparingCatalogOrder: vi.fn(),
}))
const order = {
  id: "order-1", displayNumber: "#7", orderNumber: 7, status: "Requested" as const,
  customerId: "customer-1", customerName: "Ana", customerEmail: null, customerPhone: null,
  customerNote: null, totalAmount: 15, currency: "BRL", rejectedReason: null,
  cancelledReason: null, createdAt: "2026-10-28T12:00:00Z", items: [], history: [],
}
function renderDetail() {
  return render(<MemoryRouter initialEntries={["/catalogo/pedidos/order-1"]}>
    <TestPermissionProvider permissions={["catalog.orders.read", "catalog.orders.manage"]}>
      <Routes><Route path="/catalogo/pedidos/:orderId" element={<CatalogOrderDetailPage />} /></Routes>
    </TestPermissionProvider>
  </MemoryRouter>)
}
describe("staff order detail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCatalogOrder).mockResolvedValue(order)
    vi.mocked(listCatalogProducts).mockResolvedValue([])
  })
  afterEach(async () => { await i18n.changeLanguage("pt-BR") })
  it.each(["reject", "cancel"] as const)("requires a nonblank %s reason before confirmation", async (action) => {
    const user = userEvent.setup()
    renderDetail()
    await user.click(await screen.findByRole("button", { name: i18n.t(`catalog.orders.actions.${action}`) }))
    const dialog = screen.getByRole("dialog")
    const confirm = within(dialog).getByRole("button", { name: i18n.t("catalog.orders.reason.confirm") })
    const reason = within(dialog).getByRole("textbox")
    expect(confirm).toBeDisabled()
    await user.type(reason, "   ")
    expect(confirm).toBeDisabled()
    await user.type(reason, "Unavailable")
    expect(confirm).toBeEnabled()
    expect(rejectCatalogOrder).not.toHaveBeenCalled()
    expect(cancelCatalogOrder).not.toHaveBeenCalled()
  })
  it.each([["pt-BR", "Informe o motivo."], ["en", "Enter a reason."], ["es", "Indica el motivo."]])("localizes invalid reasons in %s", async (language, message) => {
    await i18n.changeLanguage(language)
    const user = userEvent.setup()
    renderDetail()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.orders.actions.reject") }))
    const reason = screen.getByRole("textbox")
    fireEvent.submit(reason.closest("form")!)
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(/Invalid input/)).not.toBeInTheDocument()
  })
  it.each([
    ["Requested", "warning"], ["Approved", "info"], ["Preparing", "info"],
    ["Ready", "success"], ["Completed", "success"], ["Rejected", "danger"], ["Cancelled", "muted"],
  ] as const)("uses the list chip tone for %s", async (status, tone) => {
    vi.mocked(getCatalogOrder).mockResolvedValue({ ...order, status })
    renderDetail()
    const chip = await screen.findByText(i18n.t(`catalog.status.${status}`))
    expect(chip).toHaveAttribute("data-tone", tone)
  })
  it("localizes an Invalid input response from a reason mutation", async () => {
    const user = userEvent.setup()
    vi.mocked(rejectCatalogOrder).mockRejectedValue(new Error("Invalid input"))
    renderDetail()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.orders.actions.reject") }))
    await user.type(screen.getByRole("textbox"), "Unavailable")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.orders.reason.confirm") }))
    expect(toast.error).toHaveBeenCalledWith("Informe o motivo.")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

})
