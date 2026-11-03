import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogOrderAllocationPanel } from "./CatalogOrderAllocationPanel"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import {
  applyCatalogOrderAllocationUsage,
  approveCatalogOrderWithPlanning,
  CatalogForbiddenError,
  CatalogPlanningVersionConflictError,
  previewCatalogOrderAllocation,
} from "@/features/catalog/services/catalogService"
import { getUnits } from "@/features/assets/services/unitsService"
import type { CatalogOrder } from "@/features/catalog/schemas/catalogSchemas"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/catalog/services/catalogService", () => ({
  CatalogPlanningVersionConflictError: class extends Error {},
  CatalogForbiddenError: class extends Error {},
  previewCatalogOrderAllocation: vi.fn(),
  approveCatalogOrderWithPlanning: vi.fn(),
  applyCatalogOrderAllocationUsage: vi.fn(),
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

const UNIT = { id: "11111111-1111-4111-8111-111111111111", tenantId: "t1", name: "Unit A", code: null, isActive: true }

const BASE_ORDER: CatalogOrder = {
  id: "order-1",
  displayNumber: "#7",
  orderNumber: 7,
  status: "Requested",
  customerId: "customer-1",
  customerName: "Ana",
  customerEmail: null,
  customerPhone: null,
  customerNote: null,
  totalAmount: 15,
  currency: "BRL",
  rejectedReason: null,
  cancelledReason: null,
  createdAt: "2026-10-28T12:00:00Z",
  items: [
    {
      id: "item-1",
      productId: "product-1",
      productName: "Churrasqueira",
      productCode: null,
      unitPrice: 15,
      currency: "BRL",
      quantity: 1,
      subTotal: 15,
      productionSummary: "Unscheduled",
      allocation: null,
    },
  ],
  history: [],
  orderVersion: "1",
  planningRevision: 1,
  productionSummary: "Unscheduled",
  estimatedReadyAt: null,
}

const ALLOCATION = {
  id: "allocation-1",
  requirementId: "requirement-1",
  rentalAssetId: "asset-1",
  status: "Scheduled" as const,
  plannedWorkStart: "2026-11-02T13:00:00Z",
  plannedWorkEnd: "2026-11-02T14:00:00Z",
  timeZoneId: "America/Sao_Paulo",
  actualStartAt: null,
  actualWorkFinishedAt: null,
  actualReleaseAt: null,
  planningRevision: 2,
}

function renderPanel(order: CatalogOrder, permissions: readonly string[] = ["catalog.orders.manage", "catalog.orders.allocate"]) {
  const onOrderChange = vi.fn()
  const onReloadNeeded = vi.fn()
  render(
    <TestPermissionProvider permissions={permissions}>
      <CatalogOrderAllocationPanel order={order} onOrderChange={onOrderChange} onReloadNeeded={onReloadNeeded} />
    </TestPermissionProvider>,
  )
  return { onOrderChange, onReloadNeeded }
}

describe("CatalogOrderAllocationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUnits).mockResolvedValue([UNIT])
  })

  it("renders the allocation preview when feasible", async () => {
    vi.mocked(previewCatalogOrderAllocation).mockResolvedValue({
      isFeasible: true,
      orderItemId: "item-1",
      rentalAssetId: "asset-1",
      workStart: "2026-11-02T13:00:00Z",
      workEnd: "2026-11-02T14:00:00Z",
      occupiedStart: "2026-11-02T12:45:00Z",
      occupiedEnd: "2026-11-02T14:15:00Z",
      estimatedReadyAt: "2026-11-02T14:15:00Z",
      conflictCode: null,
      reason: null,
    })
    const user = userEvent.setup()
    renderPanel(BASE_ORDER)
    const input = await screen.findByLabelText(i18n.t("catalog.resourcePlanning.approvalPanel.workStart"), { exact: false })
    await user.type(input, "2026-11-02T13:00")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.approvalPanel.preview") }))
    expect(await screen.findByText(new RegExp(i18n.t("catalog.resourcePlanning.approvalPanel.workWindow")))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(i18n.t("catalog.resourcePlanning.approvalPanel.occupiedWindow")))).toBeInTheDocument()
  })

  it.each([
    ["resource_unavailable", "catalog.resourcePlanning.errors.resourceUnavailable"],
    ["unsupported_work_window", "catalog.resourcePlanning.errors.unsupportedWorkWindow"],
  ])("shows the localized message for a %s preview error", async (_code, i18nKey) => {
    vi.mocked(previewCatalogOrderAllocation).mockRejectedValue(new Error(i18n.t(i18nKey)))
    const user = userEvent.setup()
    renderPanel(BASE_ORDER)
    const input = await screen.findByLabelText(i18n.t("catalog.resourcePlanning.approvalPanel.workStart"), { exact: false })
    await user.type(input, "2026-11-02T13:00")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.approvalPanel.preview") }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t(i18nKey)))
  })

  it("reloads the order on a planning_version_conflict approval error", async () => {
    vi.mocked(approveCatalogOrderWithPlanning).mockRejectedValue(
      new CatalogPlanningVersionConflictError(
        i18n.t("catalog.resourcePlanning.errors.planningVersionConflict"),
      ),
    )
    const user = userEvent.setup()
    const { onReloadNeeded } = renderPanel(BASE_ORDER)
    const input = await screen.findByLabelText(i18n.t("catalog.resourcePlanning.approvalPanel.workStart"), { exact: false })
    await user.type(input, "2026-11-02T13:00")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.approvalPanel.approveAndAllocate") }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(i18n.t("catalog.resourcePlanning.errors.planningVersionConflict")),
    )
    expect(onReloadNeeded).toHaveBeenCalled()
  })

  it("shows a refusal alert above a disabled approve button and a friendly 403 text", async () => {
    const friendly = i18n.t("catalog.resourcePlanning.errors.forbidden")
    vi.mocked(approveCatalogOrderWithPlanning).mockRejectedValue(new CatalogForbiddenError(friendly))
    const user = userEvent.setup()
    renderPanel(BASE_ORDER)
    const input = await screen.findByLabelText(i18n.t("catalog.resourcePlanning.approvalPanel.workStart"), { exact: false })
    await user.type(input, "2026-11-02T13:00")
    const approveName = i18n.t("catalog.resourcePlanning.approvalPanel.approveAndAllocate")
    await user.click(screen.getByRole("button", { name: approveName }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(friendly))
    const alert = screen.getByText(i18n.t("catalog.resourcePlanning.approvalPanel.refusalTitle")).closest('[role="alert"]') ?? screen.getByText(friendly)
    expect(alert).toHaveTextContent(friendly)
    expect(screen.queryByText(/FORBIDDEN/)).not.toBeInTheDocument()
    const approve = screen.getByRole("button", { name: approveName })
    expect(alert.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(approve).toBeDisabled()
    await user.clear(input)
    await user.type(input, "2026-11-02T14:00")
    expect(screen.queryByText(friendly)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: approveName })).toBeEnabled()
  })

  it("posts the correct usage action body when starting an allocation", async () => {
    const order: CatalogOrder = {
      ...BASE_ORDER,
      status: "Approved",
      productionSummary: "Scheduled",
      items: [{ ...BASE_ORDER.items[0], productionSummary: "Scheduled", allocation: ALLOCATION }],
    }
    vi.mocked(applyCatalogOrderAllocationUsage).mockResolvedValue(order)
    const user = userEvent.setup()
    renderPanel(order)
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.activeUse.start") }))
    await waitFor(() =>
      expect(applyCatalogOrderAllocationUsage).toHaveBeenCalledWith(
        order.id,
        ALLOCATION.id,
        "start",
        ALLOCATION.planningRevision,
      ),
    )
  })

  it("still shows release for a cancelled order with a cleaning allocation, but hides start", async () => {
    const order: CatalogOrder = {
      ...BASE_ORDER,
      status: "Cancelled",
      cancelledReason: "Customer cancelled",
      productionSummary: "InProgress",
      items: [
        {
          ...BASE_ORDER.items[0],
          productionSummary: "InProgress",
          allocation: { ...ALLOCATION, status: "Cleaning" },
        },
      ],
    }
    renderPanel(order)
    expect(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.activeUse.release") })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: i18n.t("catalog.resourcePlanning.activeUse.start") }),
    ).not.toBeInTheDocument()
  })
})
