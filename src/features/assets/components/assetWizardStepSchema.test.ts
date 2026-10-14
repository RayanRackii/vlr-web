import { describe, expect, it } from "vitest"

import { emptyPricingEditor } from "@/features/assets/components/assetWizardPricing"
import {
  emptyAssetWizardStepInput,
  isAssetWizardStepValid,
  type AssetWizardStepInput,
} from "@/features/assets/components/assetWizardStepSchema"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"

const UNIT_ID = "11111111-1111-4111-8111-111111111111"
const CATEGORY_ID = "22222222-2222-4222-8222-222222222222"
const FAMILY_ID = "33333333-3333-4333-8333-333333333333"

function validCreate(
  patch: Partial<AssetWizardStepInput> = {},
): AssetWizardStepInput {
  return emptyAssetWizardStepInput({
    unitId: UNIT_ID,
    categoryId: CATEGORY_ID,
    familyId: FAMILY_ID,
    name: "Quadra 1",
    tag: "Q-01",
    ...patch,
  })
}

describe("isAssetWizardStepValid", () => {
  it("rejects an empty or whitespace general step and accepts a filled one", () => {
    expect(isAssetWizardStepValid("general", emptyAssetWizardStepInput())).toBe(
      false,
    )
    expect(
      isAssetWizardStepValid("general", validCreate({ name: "   " })),
    ).toBe(false)
    expect(isAssetWizardStepValid("general", validCreate())).toBe(true)
    expect(isAssetWizardStepValid("unknown", validCreate())).toBe(false)
  })

  it("requires family attributes only when the family marks them required", () => {
    const textField: AssetFamilyField = {
      key: "capacity",
      type: "text",
      required: true,
      label: "Capacidade",
    }
    const numberField: AssetFamilyField = {
      key: "volts",
      type: "number",
      required: true,
      label: "Voltagem",
    }
    const booleanField: AssetFamilyField = {
      key: "covered",
      type: "boolean",
      required: true,
      label: null,
    }

    expect(
      isAssetWizardStepValid(
        "general",
        validCreate({
          familyFields: [textField],
          attributes: { capacity: "  " },
        }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "general",
        validCreate({
          familyFields: [textField],
          attributes: { capacity: "12" },
        }),
      ),
    ).toBe(true)
    expect(
      isAssetWizardStepValid(
        "general",
        validCreate({
          familyFields: [numberField],
          attributes: { volts: "abc" },
        }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "general",
        validCreate({
          familyFields: [booleanField],
          attributes: { covered: "false" },
        }),
      ),
    ).toBe(true)
  })

  it("gates bulk identity on the general step and leaves later steps out of it", () => {
    const bulk = validCreate({
      mode: "bulk",
      baseLocationName: "Bloco A",
      baseTag: "Q-",
      startNumber: 1,
      endNumber: 3,
    })

    expect(isAssetWizardStepValid("general", bulk)).toBe(true)
    expect(
      isAssetWizardStepValid(
        "general",
        validCreate({
          mode: "bulk",
          baseLocationName: "Bloco A",
          baseTag: "Q-",
          startNumber: 4,
          endNumber: 1,
        }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "general",
        validCreate({
          mode: "bulk",
          rentalType: "Good",
          baseLocationName: "Depósito",
          baseTag: "B-",
          totalQuantity: 0,
        }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "operation",
        validCreate({
          mode: "bulk",
          isRentable: true,
          totalQuantity: 0,
        }),
      ),
    ).toBe(true)
  })

  it("gates rentable quantity and queue time only on the operation step", () => {
    expect(isAssetWizardStepValid("operation", validCreate())).toBe(true)
    expect(
      isAssetWizardStepValid(
        "operation",
        validCreate({ isRentable: false, totalQuantity: Number.NaN }),
      ),
    ).toBe(true)
    expect(
      isAssetWizardStepValid(
        "operation",
        validCreate({ isRentable: true, totalQuantity: 0 }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "operation",
        validCreate({
          isRentable: true,
          queueEnabled: true,
          queueOpeningTime: "   ",
        }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "operation",
        validCreate({
          isRentable: true,
          queueEnabled: true,
          queueOpeningTime: "08:00",
        }),
      ),
    ).toBe(true)
    expect(
      isAssetWizardStepValid(
        "operation",
        validCreate({
          isRentable: true,
          rentalType: "Good",
          queueEnabled: true,
          queueOpeningTime: "",
        }),
      ),
    ).toBe(true)
  })

  it("gates pricing windows and keeps review on the steps that apply", () => {
    const pricing = emptyPricingEditor()
    expect(
      isAssetWizardStepValid("pricing", validCreate({ pricing })),
    ).toBe(true)
    expect(
      isAssetWizardStepValid(
        "pricing",
        validCreate({
          pricing: { ...pricing, endTime: "07:00" },
        }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "pricing",
        validCreate({
          pricing: { ...pricing, everydayPrice: -1 },
        }),
      ),
    ).toBe(false)

    const invalidPricing = { ...pricing, endTime: "07:00" }
    expect(
      isAssetWizardStepValid(
        "review",
        validCreate({ isRentable: false, pricing: invalidPricing }),
      ),
    ).toBe(true)
    expect(
      isAssetWizardStepValid(
        "review",
        validCreate({ isRentable: true, pricing: invalidPricing }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "review",
        validCreate({ isRentable: true, name: "" }),
      ),
    ).toBe(false)
    expect(
      isAssetWizardStepValid(
        "review",
        validCreate({ isRentable: true, pricing }),
      ),
    ).toBe(true)
  })
})
