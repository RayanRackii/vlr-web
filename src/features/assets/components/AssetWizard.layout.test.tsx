import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import i18n from "@/lib/i18n"

import { AssetWizard } from "@/features/assets/components/AssetWizard"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { Unit } from "@/features/assets/schemas/unitSchemas"

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

const UNIT_ID = "11111111-1111-4111-8111-111111111111"
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222"
const FAMILY_ID = "33333333-3333-4333-8333-333333333333"

const units: Unit[] = [
  { id: UNIT_ID, tenantId: UNIT_ID, name: "Sede", code: "SEDE", isActive: true },
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
  { id: FAMILY_ID, key: "spaces", label: "Espaços", fields: [], sortOrder: 0, isActive: true },
]

function renderWizard() {
  return render(
    <AssetWizard
      mode="create"
      open
      onOpenChange={vi.fn()}
      units={units}
      categories={categories}
      families={families}
      onCompleted={vi.fn()}
    />,
  )
}

describe("AssetWizard mobile layout", () => {
  it("renders a compact stepper for small screens alongside the full one for larger screens", () => {
    renderWizard()

    const steppers = screen.getAllByRole("navigation", { name: "Progress" })
    expect(steppers).toHaveLength(2)

    const variants = steppers.map((nav) => nav.getAttribute("data-variant"))
    expect(variants).toContain("horizontal")
    expect(variants).toContain("compact")

    const horizontalWrapper = steppers
      .find((nav) => nav.getAttribute("data-variant") === "horizontal")
      ?.closest("div")
    const compactWrapper = steppers
      .find((nav) => nav.getAttribute("data-variant") === "compact")
      ?.closest("div")

    expect(horizontalWrapper?.className).toContain("hidden")
    expect(compactWrapper?.className).toContain("sm:hidden")
  })

  it("gives Voltar and Próximo the same width so neither looks undersized on mobile", () => {
    renderWizard()

    const back = screen.getByRole("button", { name: i18n.t("assets.wizard.back") })
    const next = screen.getByRole("button", { name: i18n.t("assets.wizard.next") })

    expect(back.className).toContain("w-full")
    expect(next.className).toContain("w-full")
  })

  it("keeps bottom clearance in the scrollable step area so fields aren't hidden behind the footer", () => {
    renderWizard()

    const scrollArea = document.querySelector(".overflow-y-auto")
    expect(scrollArea).not.toBeNull()
    expect(scrollArea?.className).toMatch(/pb-\d/)
    expect(scrollArea?.className).toContain("scroll-pb-24")
  })
})
