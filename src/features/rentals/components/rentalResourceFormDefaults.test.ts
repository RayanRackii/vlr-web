import { describe, expect, it } from "vitest"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { buildRentalResourceFormValues } from "./rentalResourceFormDefaults"
import { rentalAssetSchema } from "@/features/rentals/services/scheduleService"

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

describe("rentalAssetSchema familyId", () => {
  it("accepts seeded non-RFC family ids", () => {
    const parsed = rentalAssetSchema.safeParse({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "Projetor",
      isActive: true,
      familyId: "11111111-1111-1111-1111-111111111103",
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.familyId).toBe("11111111-1111-1111-1111-111111111103")
  })
})

describe("drawer round trip of stored fields", () => {
  // R11: Localização saved but the drawer reopened empty, so the next save sent
  // location: null and wiped it. Every stored drawer field must survive
  // response -> form -> request unchanged.
  it("keeps location, capacity, visual model, horizon and cancel cutoff on an untouched edit", async () => {
    const { toCreateRentableRequest } = await import("@/features/rentals/schemas/rentalResourceSchemas")
    const editing = rentalAssetSchema.parse({
      id: "9097323e-834c-4a32-8de3-3a156933195c",
      assetId: "55bb2650-8ecf-4961-be5d-291206b4e788",
      unitId: "66596a2c-82cc-4c0a-bf36-c3c7046a03b5",
      categoryId: "3ef7d7a1-1610-4770-8980-49f4e88f79b2",
      familyId: "11111111-1111-1111-1111-111111111101",
      name: "Sala Cancelamento",
      isActive: true,
      type: "Location",
      location: "Bloco A",
      capacityPeople: 8,
      visualTemplateRevisionId: "22222222-2222-4222-8222-222222222222",
      maxAdvanceBookingDays: 30,
      cancelCutoffHours: 12,
    })
    const values = buildRentalResourceFormValues(editing, [], [], [])
    const body = toCreateRentableRequest(values, {
      creating: false,
      stored: editing.maxAdvanceBookingDays,
      storedVisualTemplateRevisionId: editing.visualTemplateRevisionId,
      storedCapacityPeople: editing.capacityPeople,
    })
    expect(body).toMatchObject({
      location: "Bloco A",
      capacityPeople: 8,
      visualTemplateRevisionId: "22222222-2222-4222-8222-222222222222",
    })
    // Unchanged overrides are omitted: UpdateRentable treats omission as "keep stored".
    expect(body).not.toHaveProperty("maxAdvanceBookingDays")
    expect(body).not.toHaveProperty("cancelCutoffHours")
  })
})
