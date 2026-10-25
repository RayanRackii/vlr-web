import { describe, expect, it } from "vitest"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { buildRentalResourceFormValues } from "./rentalResourceFormDefaults"

const SPACES = "11111111-1111-4111-8111-111111111111"
const GOODS = "22222222-2222-4222-8222-222222222222"
const families = [{ id: SPACES }, { id: GOODS }] as unknown as AssetFamily[]

describe("buildRentalResourceFormValues family", () => {
  it("prefills the edited resource family when the tenant has two families", () => {
    const editing = { id: "r1", name: "Projetor", unitId: "u", familyId: GOODS } as unknown as AdminRentalAsset
    expect(buildRentalResourceFormValues(editing, [], [], families).familyId).toBe(GOODS)
  })

  it("leaves family empty for a new resource with two families", () => {
    expect(buildRentalResourceFormValues(null, [], [], families).familyId).toBe("")
  })

  it("falls back to the single family when the API omits familyId", () => {
    const editing = { id: "r1", name: "Sala", unitId: "u" } as unknown as AdminRentalAsset
    expect(buildRentalResourceFormValues(editing, [], [], [families[0]!]).familyId).toBe(SPACES)
  })
})
