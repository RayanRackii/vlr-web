import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { AssetWizard } from "@/features/assets/components/AssetWizard"
import { DAYS } from "@/features/assets/components/assetWizardPricing"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { createAsset, getAssetById, updateAsset } from "@/features/assets/services/assetsService"
import { assetSchema } from "@/features/assets/schemas/assetSchemas"
import { bulkApplyAssetPricings, getAssetPricings, rentalPricingSchema } from "@/features/assets/services/rentalPricingService"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/assets/services/assetsService", () => ({
  createAsset: vi.fn(),
  bulkCreateAssets: vi.fn(),
  updateAsset: vi.fn(),
  getAssetById: vi.fn(),
}))

vi.mock("@/features/assets/services/rentalPricingService", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/assets/services/rentalPricingService")>(),
  bulkApplyAssetPricings: vi.fn(),
  getAssetPricings: vi.fn(),
}))

const createAssetMock = vi.mocked(createAsset)
const toastError = vi.mocked(toast.error)
const toastSuccess = vi.mocked(toast.success)

const UNIT_ID = "11111111-1111-4111-8111-111111111111"
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222"
const FAMILY_ID = "33333333-3333-4333-8333-333333333333"
const CREATED_ID = "44444444-4444-4444-8444-444444444444"

const units: Unit[] = [
  {
    id: UNIT_ID,
    tenantId: UNIT_ID,
    name: "Sede",
    code: "SEDE",
    isActive: true,
  },
]

const categories: AssetCategory[] = [
  {
    id: CATEGORY_ID,
    tenantId: UNIT_ID,
    name: "Quadra",
    manufacturer: null,
    description: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
    scheduledDeletionAt: null,
    linkedAssetsCount: 0,
  },
]

const families: AssetFamily[] = [
  {
    id: FAMILY_ID,
    key: "spaces",
    label: "Espaços",
    fields: [],
    sortOrder: 0,
    isActive: true,
  },
]

function renderWizard(mode: "create" | "edit" | "bulk" = "create", wizardFamilies = families) {
  const onOpenChange = vi.fn()
  const onCompleted = vi.fn()
  render(
    <AssetWizard
      mode={mode}
      assetId={mode === "edit" ? CREATED_ID : undefined}
      open
      onOpenChange={onOpenChange}
      units={units}
      categories={categories}
      families={wizardFamilies}
      onCompleted={onCompleted}
    />,
  )
  return { onOpenChange, onCompleted }
}

function nextButton() {
  return screen.getByRole("button", { name: i18n.t("assets.wizard.next") })
}

function backButton() {
  return screen.getByRole("button", { name: i18n.t("assets.wizard.back") })
}

function finishButton() {
  return screen.getByRole("button", { name: i18n.t("assets.wizard.finish") })
}

function categoryTrigger() {
  const trigger = document.querySelector(
    '[data-slot="select-trigger"][data-placeholder]',
  )
  if (!(trigger instanceof HTMLElement)) {
    throw new Error("missing category select")
  }
  return trigger
}

function timeInput(index: number) {
  const input = document.querySelectorAll('input[type="time"]').item(index)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`missing time input ${index}`)
  }
  return input
}

async function selectCategory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(categoryTrigger())
  await user.click(await screen.findByRole("option", { name: "Quadra" }))
}

async function fillGeneralStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.name")),
    "Quadra 1",
  )
  await user.type(
    screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.tag")),
    "Q-01",
  )
  await selectCategory(user)
}

describe("AssetWizard validity gate", () => {
  beforeEach(() => {
    createAssetMock.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  it("keeps Next enabled and focuses the first invalid field with an accessible error", async () => {
    const user = userEvent.setup()
    renderWizard()
    expect(nextButton()).toBeEnabled()
    expect(screen.queryByText(i18n.t("assets.inventory.validation.nameRequired"))).not.toBeInTheDocument()

    await user.click(nextButton())
    const category = screen.getByRole("combobox", { name: /^Tipo/ })
    expect(category).toHaveFocus()
    expect(category).toHaveAttribute("aria-required", "true")
    expect(category).toHaveAttribute("aria-invalid", "true")
    expect(category).toHaveAccessibleDescription(i18n.t("assets.inventory.validation.categoryRequired"))

    await selectCategory(user)
    await user.click(nextButton())
    const name = screen.getByRole("textbox", { name: /^Nome/ })
    expect(name).toHaveFocus()
    expect(name).toHaveAccessibleDescription(i18n.t("assets.inventory.validation.nameRequired"))
    expect((name as HTMLInputElement).labels?.[0]).toHaveTextContent("*")
    await user.type(name, "Ventilador 1")
    expect(name).not.toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("textbox", { name: /^Tag/ })).not.toHaveAttribute("aria-required", "true")
    await user.click(nextButton())
    expect(backButton()).toBeEnabled()
    expect(createAssetMock).not.toHaveBeenCalled()
  })

  it("validates empty required family fields on blur and advance, leaving optional fields unmarked", async () => {
    const user = userEvent.setup()
    renderWizard("create", [{ ...families[0], fields: [
      { key: "voltage", type: "number", required: true, label: "Voltagem" },
      { key: "model", type: "text", required: false, label: "Modelo" },
    ] }])
    const voltage = screen.getByRole("spinbutton", { name: /^Voltagem/ })
    expect(voltage).toHaveAttribute("aria-required", "true")
    expect((voltage as HTMLInputElement).labels?.[0]).toHaveTextContent("*")
    expect(voltage).not.toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("textbox", { name: /^Modelo/ })).not.toHaveAttribute("aria-required", "true")

    await user.click(voltage)
    await user.tab()
    expect(voltage).toHaveAttribute("aria-invalid", "true")
    expect(voltage).toHaveAccessibleDescription(i18n.t("common.required"))
    const name = screen.getByRole("textbox", { name: /^Nome/ })
    expect(name).not.toHaveAttribute("aria-invalid", "true")
    await user.click(name)
    await user.tab()
    expect(name).toHaveAccessibleDescription(i18n.t("assets.inventory.validation.nameRequired"))

    await user.type(name, "Ventilador 1")
    await selectCategory(user)
    await user.click(nextButton())
    expect(voltage).toHaveFocus()
    await user.type(voltage, "220")
    expect(voltage).not.toHaveAttribute("aria-invalid", "true")
    await user.click(nextButton())
    expect(backButton()).toBeEnabled()
  })

  it("gates only the current step and leaves Voltar free", async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillGeneralStep(user)
    await user.click(nextButton())

    expect(backButton()).toBeEnabled()
    expect(nextButton()).toBeEnabled()

    await user.click(
      screen.getByRole("button", {
        name: /Disponível para reserva/,
      }),
    )
    const quantity = screen.getByRole("spinbutton")
    await user.clear(quantity)
    await user.type(quantity, "0")
    await user.click(nextButton())
    expect(quantity).toHaveFocus()
    expect(quantity).toHaveAttribute("aria-required", "true")
    expect(quantity).toHaveAccessibleDescription(i18n.t("assets.inventory.validation.quantityRequired"))
    expect(nextButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()
    expect(createAssetMock).not.toHaveBeenCalled()

    await user.clear(quantity)
    await user.type(quantity, "1")
    expect(nextButton()).toBeEnabled()

    await user.click(
      screen.getByRole("button", { name: /Fila de reservas/ }),
    )
    expect(nextButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()

    await user.click(nextButton())
    expect(timeInput(0)).toHaveFocus()
    expect(timeInput(0)).toHaveAccessibleDescription(i18n.t("assets.inventory.validation.queueOpeningTimeRequired"))
    fireEvent.change(timeInput(0), { target: { value: "08:00" } })
    expect(nextButton()).toBeEnabled()

    await user.click(nextButton())
    expect(nextButton()).toBeEnabled()
    fireEvent.change(screen.getByRole("textbox", { name: /^Preço por hora/ }), { target: { value: "12,5" } })
    expect(nextButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()

    fireEvent.change(timeInput(1), { target: { value: "07:00" } })
    expect(nextButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()

    fireEvent.change(timeInput(1), { target: { value: "22:00" } })
    expect(nextButton()).toBeEnabled()

    await user.click(nextButton())
    expect(finishButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()
    expect(createAssetMock).not.toHaveBeenCalled()
  })

  it("marks bulk identity fields and explains an empty base tag on blur", async () => {
    const user = userEvent.setup()
    renderWizard("bulk")
    const tag = screen.getByRole("textbox", { name: /^Tag base/ })
    expect(tag).toHaveAttribute("aria-required", "true")
    expect((tag as HTMLInputElement).labels?.[0]).toHaveTextContent("*")
    expect(tag).not.toHaveAttribute("aria-invalid", "true")
    await user.click(tag)
    await user.tab()
    expect(tag).toHaveAccessibleDescription(i18n.t("assets.inventory.validation.baseTagRequired"))
    expect(screen.getByRole("spinbutton", { name: /^Número inicial/ })).toHaveAttribute("aria-required", "true")
    expect(screen.getByRole("spinbutton", { name: /^Número final/ })).toHaveAttribute("aria-required", "true")
  })

  it("marks pricing requirements and describes an empty time after blur", async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillGeneralStep(user)
    await user.click(nextButton())
    await user.click(screen.getByRole("button", { name: /Disponível para reserva/ }))
    await user.click(nextButton())

    const start = screen.getByLabelText(/^Início/)
    const price = screen.getByRole("textbox", { name: /^Preço por hora/ })
    expect(start).toHaveAttribute("aria-required", "true")
    expect(price).toHaveAttribute("aria-required", "true")
    expect(start).not.toHaveAttribute("aria-invalid", "true")
    fireEvent.change(start, { target: { value: "" } })
    fireEvent.blur(start)
    expect(start).toHaveAttribute("aria-invalid", "true")
    expect(start).toHaveAccessibleDescription(i18n.t("common.required"))
    fireEvent.change(start, { target: { value: "08:00" } })
    expect(start).not.toHaveAttribute("aria-invalid", "true")
    await user.click(nextButton())
    expect(price).toHaveFocus()
    expect(price).toHaveAttribute("aria-invalid", "true")
  })

  it("re-enables Concluir after a server error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createAssetMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject
        }),
    )
    const { onCompleted, onOpenChange } = renderWizard()

    await fillGeneralStep(user)
    await user.click(nextButton())
    await user.click(nextButton())

    expect(finishButton()).toBeEnabled()
    expect(screen.getByText("Quadra 1")).toBeInTheDocument()

    await user.click(finishButton())
    await waitFor(() => {
      expect(finishButton()).toBeDisabled()
    })

    rejectCreate(new Error("Tag já existe"))

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Tag já existe")
    })
    expect(finishButton()).toBeEnabled()
    expect(screen.getByText("Quadra 1")).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(createAssetMock).toHaveBeenCalledTimes(1)

    await user.click(backButton())
    await user.click(backButton())
    expect(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.name")),
    ).toHaveValue("Quadra 1")
    expect(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.tag")),
    ).toHaveValue("Q-01")

    await user.click(nextButton())
    await user.click(nextButton())
    createAssetMock.mockResolvedValueOnce({
      id: CREATED_ID,
    } as Awaited<ReturnType<typeof createAsset>>)
    await user.click(finishButton())

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledTimes(1)
    })
    expect(toastSuccess).toHaveBeenCalledWith(i18n.t("assets.wizard.success.create"))
    expect(createAssetMock).toHaveBeenCalledTimes(2)
  })
})

// The wizard uses replacement bulk rows in both create and edit modes.
describe("AssetWizard pricing units", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(bulkApplyAssetPricings).mockResolvedValue({ appliedAssetCount: 1, pricingsCreated: 7 })
    const asset = assetSchema.parse({ id: CREATED_ID, tenantId: UNIT_ID, unitId: UNIT_ID, categoryId: CATEGORY_ID, familyId: FAMILY_ID, name: "Sala 1", tag: "S-01", status: "Active", isRentable: true, requiresMaintenance: false, createdAt: "2026-10-25T00:00:00Z" })
    createAssetMock.mockResolvedValue(asset)
    vi.mocked(getAssetById).mockResolvedValue(asset)
    vi.mocked(updateAsset).mockResolvedValue(asset)
  })

  it.each([
    ["Hour", "Por hora", "Preço por hora"],
    ["Slot", "Por horário", "Preço por horário"],
    ["Day", "Por dia", "Preço por dia"],
    ["Fixed", "Fixo", "Preço fixo"],
  ] as const)("keeps %s and its label when navigating back, and sends it on create", async (unit, option, priceLabel) => {
    const user = userEvent.setup()
    renderWizard()
    await fillGeneralStep(user)
    await user.click(nextButton())
    await user.click(screen.getByRole("button", { name: /Disponível para reserva/ }))
    await user.click(nextButton())

    await user.click(screen.getByRole("combobox", { name: "Unidade de preço" }))
    await user.click(await screen.findByRole("option", { name: option }))
    expect(screen.getByRole("textbox", { name: new RegExp(`^${priceLabel}`) })).toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${priceLabel}`) }), { target: { value: "45" } })
    await user.click(nextButton())
    await user.click(backButton())
    expect(screen.getByRole("combobox", { name: "Unidade de preço" })).toHaveTextContent(option)
    expect(screen.getByRole("textbox", { name: new RegExp(`^${priceLabel}`) })).toHaveValue("45,00")
    await user.click(nextButton())
    await user.click(finishButton())

    await waitFor(() => expect(bulkApplyAssetPricings).toHaveBeenCalledWith({ assetIds: [CREATED_ID], replace: true, pricings: expect.arrayContaining([expect.objectContaining({ pricingUnit: unit, pricePerHour: 45 })]) }))
  })

  it("keeps each row's unit when rows disagree and the user does not pick a unit", async () => {
    vi.mocked(getAssetPricings).mockResolvedValue(DAYS.map((dayOfWeek, index) => rentalPricingSchema.parse({
      id: CREATED_ID, tenantId: UNIT_ID, assetId: CREATED_ID, rentalAssetId: CREATED_ID,
      dayOfWeek, startTime: "08:00:00", endTime: "22:00:00", pricePerHour: 45,
      pricingUnit: index === 0 ? "Slot" : "Day", requiresDeposit: false, depositPercentage: 0,
      createdAt: "2026-10-25T00:00:00Z",
    })))
    const user = userEvent.setup()
    renderWizard("edit")
    await waitFor(() => expect(nextButton()).toBeEnabled())
    await user.click(nextButton())
    await user.click(nextButton())
    expect(screen.getByRole("combobox", { name: "Unidade de preço" })).toHaveTextContent("Unidades diferentes por dia")
    await user.click(nextButton())
    await user.click(finishButton())
    await waitFor(() => expect(bulkApplyAssetPricings).toHaveBeenCalledWith({ assetIds: [CREATED_ID], replace: true, pricings: DAYS.map((_, index) => expect.objectContaining({ pricingUnit: index === 0 ? "Slot" : "Day", pricePerHour: 45 })) }))
  })

  it("explains why Proximo is blocked when every per-day price is empty, and shows a dash for empty days on Revisao", async () => {
    const user = userEvent.setup()
    renderWizard()
    await fillGeneralStep(user)
    await user.click(nextButton())
    await user.click(
      screen.getByRole("button", { name: /Disponível para reserva/ }),
    )
    await user.click(nextButton())

    await user.click(
      screen.getByRole("button", { name: /Definir pre.o espec.fico por dia/ }),
    )
    expect(
      screen.getByText(i18n.t("assets.inventory.validation.pricingRequired")),
    ).toBeInTheDocument()
    expect(nextButton()).toBeEnabled()

    fireEvent.change(screen.getByRole("textbox", { name: "Segunda" }), {
      target: { value: "25,00" },
    })
    expect(
      screen.queryByText(i18n.t("assets.inventory.validation.pricingRequired")),
    ).not.toBeInTheDocument()
    expect(nextButton()).toBeEnabled()

    await user.click(nextButton())
    expect(screen.getByText("Segunda: R$ 25,00/hora")).toBeInTheDocument()
    expect(screen.getByText("Terça: —")).toBeInTheDocument()
  })

})
