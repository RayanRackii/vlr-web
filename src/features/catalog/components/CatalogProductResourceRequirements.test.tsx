import { act, render, screen, waitFor, within } from "@testing-library/react"
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
import { createStepShell } from "@/features/assistant/testStepShell"
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

const RESOURCE = { id: "77777777-7777-4777-8777-777777777777", name: "Churrasqueira 1", type: "Location", categoryName: "Lazer", isActive: true }
const GOOD = { id: "88888888-8888-4888-8888-888888888888", name: "Cortadora Laser", type: "Good", categoryName: "QA goods", isActive: true }
const REQUIREMENT = {
  id: null,
  rentalAssetId: RESOURCE.id,
  assetCategoryId: null,
  resourceQuantity: 1,
  durationMinutesPerUnit: 60,
  prepMinutes: 10,
  cleanupMinutes: 5,
}

const tr = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string

function dialogScope() {
  return within(screen.getByRole("dialog"))
}

async function fillNumber(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = dialogScope().getByLabelText(label)
  await user.clear(input)
  await user.type(input, value)
}

async function addGoodThroughDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: tr("catalog.resourcePlanning.addRequirement") })[0])
  await user.click(dialogScope().getByRole("radio", { name: new RegExp(GOOD.name) }))
  await user.click(dialogScope().getByRole("button", { name: tr("catalog.resourcePlanning.dialog.confirmAdd") }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
}

describe("CatalogProductResourceRequirements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAdminRentalAssets).mockResolvedValue([RESOURCE, GOOD] as never)
  })

  it("shows the empty state with both open buttons", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 0, requirements: [] })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    expect(await screen.findByText(tr("catalog.resourcePlanning.empty.title"))).toBeInTheDocument()
    expect(screen.getByText(tr("catalog.resourcePlanning.subtitleEmpty"))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: tr("catalog.resourcePlanning.empty.action") }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(dialogScope().getByRole("button", { name: tr("common.cancel") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: tr("catalog.resourcePlanning.addRequirement") }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("searches, filters by type, previews the occupancy and adds a card", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 0, requirements: [] })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.empty.action") }))
    const dialog = dialogScope()
    expect(dialog.getByText(tr("catalog.resourcePlanning.dialog.pickPrompt"))).toBeInTheDocument()
    expect(dialog.getByRole("button", { name: tr("catalog.resourcePlanning.dialog.confirmAdd") })).toBeDisabled()
    expect(dialog.getAllByRole("radio")).toHaveLength(2)

    await user.type(dialog.getByRole("searchbox", { name: tr("catalog.resourcePlanning.dialog.searchLabel") }), "laser")
    expect(dialog.getAllByRole("radio")).toHaveLength(1)
    await user.clear(dialog.getByRole("searchbox"))
    await user.click(dialog.getByRole("combobox", { name: tr("catalog.resourcePlanning.dialog.typeFilter") }))
    await user.click(await screen.findByRole("option", { name: tr("agendas.grid.resourceType.Location") }))
    expect(dialog.getAllByRole("radio")).toHaveLength(1)
    expect(dialog.getByRole("radio", { name: new RegExp(RESOURCE.name) })).toBeInTheDocument()
    await user.click(dialog.getByRole("combobox", { name: tr("catalog.resourcePlanning.dialog.typeFilter") }))
    await user.click(await screen.findByRole("option", { name: tr("catalog.resourcePlanning.dialog.allTypes") }))

    await user.click(dialog.getByRole("radio", { name: new RegExp(GOOD.name) }))
    expect(dialog.getByText(tr("catalog.resourcePlanning.dialog.selectedCount", { count: 1 }))).toBeInTheDocument()
    await fillNumber(user, tr("catalog.resourcePlanning.fields.resourceQuantity"), "2")
    await fillNumber(user, tr("catalog.resourcePlanning.fields.durationMinutesPerUnit"), "60")
    await fillNumber(user, tr("catalog.resourcePlanning.fields.prepMinutes"), "10")
    await fillNumber(user, tr("catalog.resourcePlanning.fields.cleanupMinutes"), "5")
    expect(dialog.getByText(tr("catalog.resourcePlanning.dialog.summaryTotal", { total: 75 }))).toBeInTheDocument()
    expect(dialog.getByText(tr("catalog.resourcePlanning.breakdown", { prep: 10, duration: 60, cleanup: 5 }))).toBeInTheDocument()

    await user.click(dialog.getByRole("button", { name: tr("catalog.resourcePlanning.dialog.confirmAdd") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByText(GOOD.name)).toBeInTheDocument()
    expect(screen.getByText(`${tr("agendas.grid.resourceType.Good")} · QA goods`)).toBeInTheDocument()
    expect(screen.getByText(tr("catalog.resourcePlanning.card.units", { count: 2 }))).toBeInTheDocument()
    expect(screen.getByText(tr("catalog.resourcePlanning.card.occupancy", { total: 75 }))).toBeInTheDocument()
    expect(screen.getByText(tr("catalog.resourcePlanning.subtitleCount", { count: 1 }))).toBeInTheDocument()
  })

  it("disables confirm on invalid values and disables resources already added", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [REQUIREMENT] })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.addRequirement") }))
    const dialog = dialogScope()
    expect(dialog.getByRole("radio", { name: new RegExp(RESOURCE.name) })).toBeDisabled()
    await user.click(dialog.getByRole("radio", { name: new RegExp(GOOD.name) }))
    await fillNumber(user, tr("catalog.resourcePlanning.fields.durationMinutesPerUnit"), "0")
    expect(dialog.getByRole("button", { name: tr("catalog.resourcePlanning.dialog.confirmAdd") })).toBeDisabled()
  })

  it("edits a card from its Edit button", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [REQUIREMENT] })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    expect(await screen.findByText(tr("catalog.resourcePlanning.card.occupancy", { total: 75 }))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: tr("common.edit") }))
    const dialog = dialogScope()
    expect(dialog.getByText(tr("catalog.resourcePlanning.dialog.editTitle"))).toBeInTheDocument()
    expect(dialog.queryAllByRole("radio")).toHaveLength(0)
    await fillNumber(user, tr("catalog.resourcePlanning.fields.prepMinutes"), "30")
    await user.click(dialog.getByRole("button", { name: tr("catalog.resourcePlanning.dialog.confirmEdit") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByText(tr("catalog.resourcePlanning.card.occupancy", { total: 95 }))).toBeInTheDocument()
  })

  it("removes a card without confirmation", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [REQUIREMENT] })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.card.remove", { name: RESOURCE.name }) }))
    expect(await screen.findByText(tr("catalog.resourcePlanning.empty.title"))).toBeInTheDocument()
  })

  it("hides add, edit and remove when read-only", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [REQUIREMENT] })
    render(<CatalogProductResourceRequirements productId="product-1" readOnly />)
    expect(await screen.findByText(RESOURCE.name)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("saves with its own Save button outside a shell and sends the expectedVersion", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 4, requirements: [REQUIREMENT] })
    vi.mocked(replaceCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 5, requirements: [REQUIREMENT] })
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.save") }))
    await waitFor(() => expect(replaceCatalogProductResourceRequirements).toHaveBeenCalledWith(
      "product-1",
      expect.objectContaining({ expectedVersion: 4 }),
    ))
  })

  it("toasts the conflict message and reloads on a 409 planning_version_conflict", async () => {
    vi.mocked(getCatalogProductResourceRequirements)
      .mockResolvedValueOnce({ expectedVersion: 1, requirements: [REQUIREMENT] })
      .mockResolvedValueOnce({ expectedVersion: 2, requirements: [REQUIREMENT] })
    vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(
      new CatalogPlanningVersionConflictError(tr("catalog.resourcePlanning.errors.planningVersionConflict")),
    )
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.save") }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(tr("catalog.resourcePlanning.errors.planningVersionConflict")),
    )
    await waitFor(() => expect(getCatalogProductResourceRequirements).toHaveBeenCalledTimes(2))
  })

  it("shows the save error inline when the API refuses the requirements", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [REQUIREMENT] })
    const message = tr("catalog.resourcePlanning.errors.singleRequirementOnly")
    vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(new Error(message))
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.save") }))
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(message)
    expect(toast.error).toHaveBeenCalledWith(message)
    const saveButton = screen.getByRole("button", { name: tr("catalog.resourcePlanning.save") })
    // The refusal sits above the action buttons and blocks re-saving the same rows.
    expect(alert.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(saveButton).toBeDisabled()
  })

  it("keeps Save enabled after a retryable 5xx failure", async () => {
    vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [REQUIREMENT] })
    const message = tr("catalog.resourcePlanning.errors.saveRequirements")
    vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(new CatalogRetryableError(message))
    const user = userEvent.setup()
    render(<CatalogProductResourceRequirements productId="product-1" />)
    await user.click(await screen.findByRole("button", { name: tr("catalog.resourcePlanning.save") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(message)
    expect(screen.getByRole("button", { name: tr("catalog.resourcePlanning.save") })).toBeEnabled()
  })

  describe("inside the cadastro shell", () => {
    async function renderInShell(requirements: typeof REQUIREMENT[] = [REQUIREMENT]) {
      vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements })
      const { StepShell, shell } = createStepShell()
      const user = userEvent.setup()
      render(<StepShell><CatalogProductResourceRequirements productId="product-1" /></StepShell>)
      await screen.findByText(tr("catalog.resourcePlanning.title"))
      return { shell, user }
    }

    it("hides its Save button and resolves true without a request when unchanged", async () => {
      const { shell } = await renderInShell()
      expect(screen.queryByRole("button", { name: tr("catalog.resourcePlanning.save") })).not.toBeInTheDocument()
      let result: boolean | null = null
      await act(async () => { result = await shell.submit() })
      expect(result).toBe(true)
      expect(replaceCatalogProductResourceRequirements).not.toHaveBeenCalled()
    })

    it("sends the replace payload with the added resource and resolves true", async () => {
      vi.mocked(replaceCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 2, requirements: [REQUIREMENT] })
      const { shell, user } = await renderInShell()
      await addGoodThroughDialog(user)
      let result: boolean | null = null
      await act(async () => { result = await shell.submit() })
      expect(result).toBe(true)
      expect(replaceCatalogProductResourceRequirements).toHaveBeenCalledWith("product-1", {
        expectedVersion: 1,
        requirements: [
          { rentalAssetId: RESOURCE.id, assetCategoryId: null, resourceQuantity: 1, durationMinutesPerUnit: 60, prepMinutes: 10, cleanupMinutes: 5 },
          { rentalAssetId: GOOD.id, assetCategoryId: null, resourceQuantity: 1, durationMinutesPerUnit: 60, prepMinutes: 0, cleanupMinutes: 0 },
        ],
      })
    })

    it("resolves false with an inline alert when the API refuses the rows", async () => {
      vi.mocked(replaceCatalogProductResourceRequirements).mockRejectedValue(new Error("Recusado"))
      const { shell, user } = await renderInShell([])
      await addGoodThroughDialog(user)
      let result: boolean | null = null
      await act(async () => { result = await shell.submit() })
      expect(result).toBe(false)
      expect(await screen.findByRole("alert")).toHaveTextContent("Recusado")
    })
  })
})
