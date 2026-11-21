import { describe, expect, it } from "vitest"

import { suggestReferencePlan } from "@/features/admin/lib/referencePlan"
import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"

function plan(id: string, modules: string[], monthlyPriceCents: number): PublicPlan {
  return {
    id,
    packageKey: "x",
    planKey: "essencial",
    name: id,
    monthlyPriceCents,
    annualPriceCents: monthlyPriceCents * 10,
    currency: "BRL",
    modules,
    limits: {},
    sortOrder: 0,
  }
}

describe("suggestReferencePlan", () => {
  const plans = [
    plan("big", ["rentals", "inventory", "catalog"], 29900),
    plan("rent", ["rentals"], 9900),
    plan("maint", ["inventory", "pmoc", "os"], 12900),
  ]

  it("picks the cheapest plan whose modules cover the selection", () => {
    expect(suggestReferencePlan(plans, ["Rentals"])?.id).toBe("rent")
    expect(suggestReferencePlan(plans, ["rentals", "inventory"])?.id).toBe("big")
    expect(suggestReferencePlan(plans, ["Pmoc", "os"])?.id).toBe("maint")
  })

  it("returns null with no selection or when nothing covers it", () => {
    expect(suggestReferencePlan(plans, [])).toBeNull()
    expect(suggestReferencePlan(plans, ["pmoc", "catalog"])).toBeNull()
    expect(suggestReferencePlan([], ["rentals"])).toBeNull()
  })
})
