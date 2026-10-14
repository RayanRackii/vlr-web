import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { AssetWizard } from "@/features/assets/components/AssetWizard"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"
import { createAsset } from "@/features/assets/services/assetsService"
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

vi.mock("@/features/assets/services/rentalPricingService", () => ({
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

function renderWizard() {
  const onOpenChange = vi.fn()
  const onCompleted = vi.fn()
  render(
    <AssetWizard
      mode="create"
      open
      onOpenChange={onOpenChange}
      units={units}
      categories={categories}
      families={families}
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

  it("keeps Próximo disabled until the general step schema is valid", async () => {
    const user = userEvent.setup()
    renderWizard()

    expect(nextButton()).toBeDisabled()
    expect(backButton()).toBeDisabled()
    expect(createAssetMock).not.toHaveBeenCalled()

    await user.type(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.name")),
      "   ",
    )
    await user.type(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.tag")),
      "Q-01",
    )
    expect(nextButton()).toBeDisabled()

    await user.clear(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.name")),
    )
    await user.type(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.name")),
      "Quadra 1",
    )
    expect(nextButton()).toBeDisabled()

    await selectCategory(user)
    expect(nextButton()).toBeEnabled()

    await user.clear(
      screen.getByPlaceholderText(i18n.t("assets.wizard.placeholders.name")),
    )
    expect(nextButton()).toBeDisabled()
    expect(backButton()).toBeDisabled()
    expect(createAssetMock).not.toHaveBeenCalled()
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
        name: /Disponível para reserva \/ aluguel/,
      }),
    )
    const quantity = screen.getByRole("spinbutton")
    await user.clear(quantity)
    await user.type(quantity, "0")
    expect(nextButton()).toBeDisabled()
    expect(backButton()).toBeEnabled()
    expect(createAssetMock).not.toHaveBeenCalled()

    await user.clear(quantity)
    await user.type(quantity, "1")
    expect(nextButton()).toBeEnabled()

    await user.click(
      screen.getByRole("button", { name: /Fila de reservas/ }),
    )
    expect(nextButton()).toBeDisabled()
    expect(backButton()).toBeEnabled()

    fireEvent.change(timeInput(0), { target: { value: "08:00" } })
    expect(nextButton()).toBeEnabled()

    await user.click(nextButton())
    expect(nextButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()

    fireEvent.change(timeInput(1), { target: { value: "07:00" } })
    expect(nextButton()).toBeDisabled()
    expect(backButton()).toBeEnabled()

    fireEvent.change(timeInput(1), { target: { value: "22:00" } })
    expect(nextButton()).toBeEnabled()

    await user.click(nextButton())
    expect(finishButton()).toBeEnabled()
    expect(backButton()).toBeEnabled()
    expect(createAssetMock).not.toHaveBeenCalled()
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
