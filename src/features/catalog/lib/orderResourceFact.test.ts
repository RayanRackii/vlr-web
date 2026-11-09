import { describe, expect, it } from "vitest"

import { orderResourceFact } from "@/features/catalog/lib/orderResourceFact"

describe("orderResourceFact", () => {
  it("names the resource and the unit it belongs to", () => {
    expect(orderResourceFact(
      [{ rentalAssetId: "asset-1", durationMinutesPerUnit: 60, resourceQuantity: 1 }],
      [{ id: "asset-1", name: "Quadra", unitId: "unit-1" }],
    )).toEqual({
      kind: "named",
      name: "Quadra",
      rentalAssetId: "asset-1",
      unitId: "unit-1",
      durationMinutesPerUnit: 60,
      resourceQuantity: 1,
    })
  })

  it("is none when the product does not use a resource", () => {
    expect(orderResourceFact([], [])).toEqual({ kind: "none" })
  })
})
