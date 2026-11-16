import { describe, expect, it } from "vitest"

import { catalogSaleReadinessSchema } from "@/features/catalog/schemas/catalogSchemas"

describe("catalogSaleReadinessSchema", () => {
  it("accepts a null or absent missing list as empty", () => {
    expect(catalogSaleReadinessSchema.parse({ ready: true, missing: null })).toEqual({ ready: true, missing: [] })
    expect(catalogSaleReadinessSchema.parse({ ready: true })).toEqual({ ready: true, missing: [] })
  })

  it("keeps the codes when present", () => {
    expect(catalogSaleReadinessSchema.parse({ ready: false, missing: ["PRICE"] }).missing).toEqual(["PRICE"])
  })
})
