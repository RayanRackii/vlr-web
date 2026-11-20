import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CatalogOrderDetailPage } from "./CatalogOrderDetailPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getCatalogOrder, getCatalogProductResourceRequirements, listCatalogProducts, rejectCatalogOrder, cancelCatalogOrder, approveCatalogOrder, startPreparingCatalogOrder, markCatalogOrderReady, completeCatalogOrder, applyCatalogOrderAllocationUsage } from "../services/catalogService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock("../services/catalogService", () => ({
  getCatalogOrder: vi.fn(), listCatalogProducts: vi.fn(), rejectCatalogOrder: vi.fn(),
  cancelCatalogOrder: vi.fn(), approveCatalogOrder: vi.fn(), completeCatalogOrder: vi.fn(),
  markCatalogOrderReady: vi.fn(), startPreparingCatalogOrder: vi.fn(),
  getCatalogProductResourceRequirements: vi.fn(),
  applyCatalogOrderAllocationUsage: vi.fn(),
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
const ALL_PERMISSIONS = ["catalog.orders.read", "catalog.orders.manage", "catalog.orders.allocate", "rentals.schedule.read"]
const ALLOCATION = {
  id: "allocation-1", requirementId: "requirement-1", rentalAssetId: "asset-1", status: "Running" as const,
  plannedWorkStart: "2026-11-26T17:00:00Z", plannedWorkEnd: "2026-11-26T20:00:00Z", timeZoneId: "America/Sao_Paulo",
  actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, planningRevision: 2,
}
const ALLOCATED_ITEM = {
  id: "33333333-3333-4333-8333-333333333333", productId: "11111111-1111-4111-8111-111111111111",
  productName: "Impressao 3D", productCode: null, unitPrice: 90, currency: "BRL", quantity: 1, subTotal: 90,
  productionSummary: "Scheduled" as const, allocation: ALLOCATION,
}
async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: i18n.t("catalog.orders.moreActions") }))
}
function renderDetail(unified = false, permissions: readonly string[] = ["catalog.orders.read", "catalog.orders.manage"], activeModules: readonly string[] = ["catalog", "rentals"]) {
  return render(<MemoryRouter initialEntries={[unified ? "/pedidos/order-1" : "/catalogo/pedidos/order-1"]}>
    <TestPermissionProvider permissions={permissions} activeModules={activeModules}>
      <Routes><Route path={unified ? "/pedidos/:orderId" : "/catalogo/pedidos/:orderId"} element={<CatalogOrderDetailPage unified={unified} />} /></Routes>
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
  it("reuses order data with the new child chrome and no CatalogTabs", async () => {
    renderDetail(true)
    expect(await screen.findByRole("heading", { level: 1, name: i18n.t("pedidos.detailTitle") })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: i18n.t("catalog.products.title") })).not.toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(getCatalogOrder).toHaveBeenCalledWith("order-1")
  })

  it.each(["reject", "cancel"] as const)("requires a nonblank %s reason before confirmation", async (action) => {
    const user = userEvent.setup()
    renderDetail()
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: i18n.t(`catalog.orders.actions.${action}`) }))
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
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("catalog.orders.actions.reject") }))
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
    await openMenu(user)
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("catalog.orders.actions.reject") }))
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

  it("shows the current step in the progress line for each status", async () => {
    for (const [status, index] of [["Requested", 0], ["Approved", 1], ["Preparing", 2], ["Ready", 3], ["Completed", 4]] as const) {
      vi.mocked(getCatalogOrder).mockResolvedValue({ ...order, status })
      const { unmount } = renderDetail()
      const list = await screen.findByRole("list", { name: i18n.t("catalog.orders.progressLabel") })
      const steps = within(list).getAllByRole("listitem")
      expect(steps).toHaveLength(5)
      expect(steps[index]).toHaveAttribute("aria-current", "true")
      expect(steps.filter((li) => li.getAttribute("aria-current") === "true")).toHaveLength(1)
      unmount()
    }
  })

  it.each(["Rejected", "Cancelled"] as const)("ends the progress line on the terminal state %s", async (status) => {
    vi.mocked(getCatalogOrder).mockResolvedValue({ ...order, status })
    renderDetail()
    const list = await screen.findByRole("list", { name: i18n.t("catalog.orders.progressLabel") })
    const steps = within(list).getAllByRole("listitem")
    expect(steps[steps.length - 1]).toHaveAttribute("aria-current", "true")
    expect(within(steps[steps.length - 1]).getByText(i18n.t(`catalog.status.${status}`))).toBeInTheDocument()
  })

  it.each([
    ["Requested", "approve", approveCatalogOrder],
    ["Approved", "preparing", startPreparingCatalogOrder],
    ["Preparing", "ready", markCatalogOrderReady],
    ["Ready", "complete", completeCatalogOrder],
  ] as const)("offers %s -> %s as the single primary action", async (status, action, fn) => {
    vi.mocked(getCatalogOrder).mockResolvedValue({ ...order, status })
    vi.mocked(fn).mockResolvedValue({ ...order, status })
    const user = userEvent.setup()
    renderDetail()
    const label = i18n.t(`catalog.orders.actions.${action}`)
    await user.click(await screen.findByRole("button", { name: label }))
    expect(fn).toHaveBeenCalledWith(order.id)
    for (const other of ["approve", "preparing", "ready", "complete"].filter((a) => a !== action)) {
      expect(screen.queryByRole("button", { name: i18n.t(`catalog.orders.actions.${other}`) })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole("button", { name: i18n.t("catalog.orders.actions.cancel") })).not.toBeInTheDocument()
  })

  it("keeps reject and cancel in the more-actions menu for a requested order", async () => {
    const user = userEvent.setup()
    renderDetail()
    await openMenu(user)
    expect(await screen.findByRole("menuitem", { name: i18n.t("catalog.orders.actions.reject") })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: i18n.t("catalog.orders.actions.cancel") })).toBeInTheDocument()
  })

  it("has no actions without the manage permission", async () => {
    renderDetail(false, ["catalog.orders.read"])
    await screen.findByRole("list", { name: i18n.t("catalog.orders.progressLabel") })
    expect(screen.queryByRole("button", { name: i18n.t("catalog.orders.actions.approve") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.orders.moreActions") })).not.toBeInTheDocument()
  })

  it("shows the resource window on the item, one resource-use detail line and no second status block", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({ ...order, status: "Approved", productionSummary: "Scheduled", items: [ALLOCATED_ITEM] })
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 1,
      requirements: [{ rentalAssetId: "asset-1", assetCategoryId: null, resourceQuantity: 1, durationMinutesPerUnit: 180, prepMinutes: 0, cleanupMinutes: 0 }],
    })
    vi.mocked(listAdminRentalAssets).mockResolvedValue([{ id: "asset-1", name: "Impressora 3D Alfa", unitId: "u1" }] as never)
    renderDetail(false, ALL_PERMISSIONS)
    expect(await screen.findByText(/26\/11, 14:00.17:00 · Impressora 3D Alfa/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: i18n.t("catalog.orders.openInAgenda") })).toHaveAttribute("href", "/agendas/recursos?date=2026-11-26")
    expect(screen.getAllByText(new RegExp(`${i18n.t("catalog.orders.resourceUsage")}:`))).toHaveLength(1)
    expect(screen.queryByRole("heading", { name: i18n.t("catalog.resourcePlanning.productionSummary.title") })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: i18n.t("catalog.resourcePlanning.activeUse.title") })).not.toBeInTheDocument()
  })

  it("keeps the order transition primary and puts work-finished and the agenda link in the menu", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({ ...order, status: "Approved", productionSummary: "InProgress", items: [ALLOCATED_ITEM] })
    vi.mocked(applyCatalogOrderAllocationUsage).mockResolvedValue({ ...order, status: "Approved", items: [ALLOCATED_ITEM] })
    const user = userEvent.setup()
    renderDetail(false, ALL_PERMISSIONS)
    expect(await screen.findByRole("button", { name: i18n.t("catalog.orders.actions.preparing") })).toBeInTheDocument()
    await openMenu(user)
    expect(await screen.findByRole("menuitem", { name: i18n.t("catalog.orders.openInAgenda") })).toBeInTheDocument()
    await user.click(screen.getByRole("menuitem", { name: i18n.t("catalog.resourcePlanning.activeUse.workFinished") }))
    expect(applyCatalogOrderAllocationUsage).toHaveBeenCalledWith(order.id, "allocation-1", "work-finished", 2)
  })

  it("promotes release to the primary action of a cancelled order with a cleaning allocation", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({
      ...order, status: "Cancelled", productionSummary: "InProgress",
      items: [{ ...ALLOCATED_ITEM, allocation: { ...ALLOCATION, status: "Cleaning" } }],
    })
    vi.mocked(applyCatalogOrderAllocationUsage).mockResolvedValue({ ...order, status: "Cancelled" })
    const user = userEvent.setup()
    renderDetail(false, ALL_PERMISSIONS)
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.activeUse.release") }))
    expect(applyCatalogOrderAllocationUsage).toHaveBeenCalledWith(order.id, "allocation-1", "release", 2)
  })

  it("hides usage actions without the allocate permission", async () => {
    vi.mocked(getCatalogOrder).mockResolvedValue({
      ...order, status: "Cancelled", productionSummary: "InProgress",
      items: [{ ...ALLOCATED_ITEM, allocation: { ...ALLOCATION, status: "Cleaning" } }],
    })
    renderDetail(false, ["catalog.orders.read", "catalog.orders.manage"])
    await screen.findByRole("list", { name: i18n.t("catalog.orders.progressLabel") })
    expect(screen.queryByRole("button", { name: i18n.t("catalog.resourcePlanning.activeUse.release") })).not.toBeInTheDocument()
  })

})
