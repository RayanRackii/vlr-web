import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CatalogOrderDetailPage } from "./CatalogOrderDetailPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getCatalogOrder, getCatalogProductResourceRequirements, listCatalogProducts, rejectCatalogOrder, cancelCatalogOrder, approveCatalogOrder } from "../services/catalogService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("../services/catalogService", () => ({
  getCatalogOrder: vi.fn(), listCatalogProducts: vi.fn(), rejectCatalogOrder: vi.fn(),
  cancelCatalogOrder: vi.fn(), approveCatalogOrder: vi.fn(), completeCatalogOrder: vi.fn(),
  markCatalogOrderReady: vi.fn(), startPreparingCatalogOrder: vi.fn(),
  getCatalogProductResourceRequirements: vi.fn(),
}))
vi.mock("@/features/rentals/services/scheduleService", () => ({
  listAdminRentalAssets: vi.fn(),
}))
vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn().mockResolvedValue([]),
}))
const order = {
  id: "order-1", displayNumber: "#7", orderNumber: 7, status: "Requested" as const,
  customerId: "customer-1", customerName: "Ana", customerEmail: null, customerPhone: null,
  customerNote: null, totalAmount: 15, currency: "BRL", rejectedReason: null,
  cancelledReason: null, createdAt: "2026-10-28T12:00:00Z", items: [], history: [],
  orderVersion: "0", planningRevision: 0, productionSummary: "NotRequired" as const,
  estimatedReadyAt: null,
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
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 0, requirements: [] })
    vi.mocked(listAdminRentalAssets).mockResolvedValue([])
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
  it("labels a B2BUser history entry with the actor name and System without one", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({
      ...order,
      history: [
        { id: "h1", status: "Approved", actorType: "B2BUser", actorId: "u1", actorName: "João", reason: null, createdAt: "2026-10-28T12:00:00Z" },
        { id: "h2", status: "Ready", actorType: "System", actorId: null, actorName: null, reason: null, createdAt: "2026-10-28T13:00:00Z" },
      ],
    })
    renderDetail()
    expect(await screen.findByText(new RegExp(`${i18n.t("catalog.actor.B2BUser")} · João`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`^${i18n.t("catalog.actor.System")} ·`))).toBeInTheDocument()
  })

  it("renders usage milestone history with friendly labels, actor, and no raw reason code", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({
      ...order,
      history: [
        { id: "h1", status: "Preparing", actorType: "B2BUser", actorId: "u1", actorName: "Maria", reason: "usage.workFinished", createdAt: "2026-10-28T14:00:00Z" },
        { id: "h2", status: "Ready", actorType: "B2BUser", actorId: "u1", actorName: "Maria", reason: "usage.released", createdAt: "2026-10-28T15:00:00Z" },
      ],
    })
    renderDetail()
    expect(await screen.findByText(i18n.t("catalog.orders.history.workFinished"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("catalog.orders.history.released"))).toBeInTheDocument()
    // The raw reason code is hidden once it maps to a friendly milestone label.
    expect(screen.queryByText("usage.workFinished")).not.toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(`^${i18n.t("catalog.actor.B2BUser")} · Maria`)).length).toBeGreaterThan(0)
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

  it("names the resource on the order and does not offer one-click approve", async () => {
    const productId = "11111111-1111-4111-8111-111111111111"
    const assetId = "22222222-2222-4222-8222-222222222222"
    vi.mocked(getCatalogOrder).mockResolvedValue({
      ...order,
      productionSummary: "Unscheduled",
      items: [{
        id: "33333333-3333-4333-8333-333333333333",
        productId,
        productName: "Kit festa",
        productCode: null,
        unitPrice: 10,
        currency: "BRL",
        quantity: 1,
        subTotal: 10,
        productionSummary: "Unscheduled",
        allocation: null,
      }],
    })
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 1,
      requirements: [{
        rentalAssetId: assetId,
        assetCategoryId: null,
        resourceQuantity: 1,
        durationMinutesPerUnit: 60,
        prepMinutes: 0,
        cleanupMinutes: 0,
      }],
    })
    vi.mocked(listAdminRentalAssets).mockResolvedValue([
      { id: assetId, name: "Quadra coberta", unitId: "44444444-4444-4444-8444-444444444444" },
    ] as never)
    renderDetail()
    expect(await screen.findByText(i18n.t("catalog.resourcePlanning.approvalPanel.resourceNamed", {
      name: "Quadra coberta",
      minutes: 60,
    }))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.orders.actions.approve") })).not.toBeInTheDocument()
  })

  it("approves in one click when the order does not book a resource", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({
      ...order,
      items: [{
        id: "33333333-3333-4333-8333-333333333333",
        productId: "11111111-1111-4111-8111-111111111111",
        productName: "Suco",
        productCode: null,
        unitPrice: 10,
        currency: "BRL",
        quantity: 1,
        subTotal: 10,
        productionSummary: "NotRequired",
        allocation: null,
      }],
    })
    vi.mocked(approveCatalogOrder).mockResolvedValue({ ...order, status: "Approved" })
    const user = userEvent.setup()
    renderDetail()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.orders.actions.approve") }))
    expect(approveCatalogOrder).toHaveBeenCalledWith(order.id)
  })

})
