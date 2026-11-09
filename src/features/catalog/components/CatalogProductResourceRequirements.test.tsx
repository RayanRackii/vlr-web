import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogProductResourceRequirements } from "./CatalogProductResourceRequirements"
import {
  CatalogPlanningVersionConflictError,
  CatalogRetryableError,
  getCatalogProductResourceRequirements,
  replaceCatalogProductResourceRequirements,
} from "@/features/catalog/services/catalogService"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/catalog/services/catalogService", () => ({
  CatalogPlanningVersionConflictError: class extends Error {},
  CatalogRetryableError: class extends Error {},
  getCatalogProductResourceRequirements: vi.fn(),
  replaceCatalogProductResourceRequirements: vi.fn(),
}))

vi.mock("@/features/rentals/services/scheduleService", () => ({
  listAdminRentalAssets: vi.fn(),
}))

const RESOURCE = { id: "77777777-7777-4777-8777-777777777777", name: "Churrasqueira 1" }

describe("CatalogProductResourceRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAdminRentalAssets).mockResolvedValue([RESOURCE] as never)
  })

  it("shows the no-scheduling empty state when there are no requirements", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 0,
      requirements: [],
    })
    render(<CatalogProductResourceRequirements productId="product-1" />)
    expect(
      await screen.findByText(i18n.t("catalog.resourcePlanning.emptyState")),
    ).toBeInTheDocument()
  })

  it("sends the loaded expectedVersion when saving", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 4,
      requirements: [
        {
          id: null,
          rentalAssetId: RESOURCE.id,
          assetCategoryId: null,
          resourceQuantity: 1,
          durationMinutesPerUnit: 60,
          prepMinutes: 0,
          cleanupMinutes: 0,
        },
      ],
    })
    vi.mocked(replaceCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 5,
      requirements: [],
    })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    expect(await screen.findByRole("button", { name: "Churrasqueira 1" })).toHaveAttribute("aria-pressed", "true")
    expect(document.querySelector(".lucide-chevron-down, .lucide-chevron-up")).toBeNull()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.save") }))
    await waitFor(() => expect(replaceCatalogProductResourceRequirements).toHaveBeenCalledWith(
      "product-1",
      expect.objectContaining({ expectedVersion: 4 }),
    ))
  })

  it("toasts the conflict message and reloads on a 409 planning_version_conflict", async () => {
    const requirement = {
      id: null,
      rentalAssetId: RESOURCE.id,
      assetCategoryId: null,
      resourceQuantity: 1,
      durationMinutesPerUnit: 60,
      prepMinutes: 0,
      cleanupMinutes: 0,
    }
    vi.mocked(getCatalogProductResourceRequirements)
      .mockResolvedValueOnce({ expectedVersion: 1, requirements: [requirement] })
      .mockResolvedValueOnce({ expectedVersion: 2, requirements: [requirement] })
    vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(
      new CatalogPlanningVersionConflictError(
        i18n.t("catalog.resourcePlanning.errors.planningVersionConflict"),
      ),
    )
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.save") }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        i18n.t("catalog.resourcePlanning.errors.planningVersionConflict"),
      ),
    )
    await waitFor(() => expect(getCatalogProductResourceRequirements).toHaveBeenCalledTimes(2))
  })

  it("shows the save error inline in the form when the API refuses the requirements", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 1,
      requirements: [
        {
          id: null,
          rentalAssetId: RESOURCE.id,
          assetCategoryId: null,
          resourceQuantity: 1,
          durationMinutesPerUnit: 60,
          prepMinutes: 0,
          cleanupMinutes: 0,
        },
      ],
    })
    const message = i18n.t("catalog.resourcePlanning.errors.singleRequirementOnly")
    vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(new Error(message))
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.save") }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(message)
    expect(toast.error).toHaveBeenCalledWith(message)
    const saveButton = screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.save") })
    // The refusal sits above the action buttons and blocks re-saving the same rows.
    expect(alert.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(saveButton).toBeDisabled()
  })

  it("keeps Save enabled after a retryable 5xx failure", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({
      expectedVersion: 1,
      requirements: [
        {
          id: null,
          rentalAssetId: RESOURCE.id,
          assetCategoryId: null,
          resourceQuantity: 1,
          durationMinutesPerUnit: 60,
          prepMinutes: 0,
          cleanupMinutes: 0,
        },
      ],
    })
    const message = i18n.t("catalog.resourcePlanning.errors.saveRequirements")
    vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(
      new CatalogRetryableError(message),
    )
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.resourcePlanning.save") }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(message)
    // Transient failure: the error shows but the user may retry the same save.
    expect(screen.getByRole("button", { name: i18n.t("catalog.resourcePlanning.save") })).toBeEnabled()
  })
})
