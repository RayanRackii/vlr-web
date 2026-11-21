import { describe, expect, it } from "vitest"

import {
  billingSummarySchema,
  parsePublicPlans,
  tenantSubscriptionSchema,
} from "@/features/billing/schemas/billingSchemas"

const plan = {
  id: "11111111-1111-4111-8111-111111111111",
  packageKey: "reservas",
  planKey: "essencial",
  name: "Essencial",
  monthlyPriceCents: 9900,
  annualPriceCents: 99000,
  currency: "BRL",
  modules: ["rentals"],
  limits: { assets: null, rentableResources: 3, users: 3, units: 1, whatsappMessagesMonth: null },
  sortOrder: 2,
}

describe("billing schemas (tolerant readers)", () => {
  it("parses public plans sorted by sortOrder and keeps null limits as unlimited", () => {
    const plans = parsePublicPlans([
      { ...plan, id: "b", planKey: "completo", sortOrder: 3 },
      { ...plan, id: "a", sortOrder: 1 },
    ])
    expect(plans.map((row) => row.id)).toEqual(["a", "b"])
    expect(plans[0]?.limits.assets).toBeNull()
    expect(plans[0]?.limits.rentableResources).toBe(3)
  })

  it("drops unreadable rows, tolerates missing optional fields and ignores unknown ones", () => {
    const plans = parsePublicPlans([
      { id: "ok", packageKey: "locacao", planKey: "completo", future: { x: 1 } },
      { packageKey: "reservas" },
      "nope",
    ])
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ id: "ok", currency: "BRL", modules: [], monthlyPriceCents: 0 })
    expect(parsePublicPlans(null)).toEqual([])
    expect(parsePublicPlans({ plans: [] })).toEqual([])
  })

  it("reads a tenant subscription with defaults for everything missing", () => {
    const parsed = tenantSubscriptionSchema.parse({ tenantId: "t", hasSubscription: false })
    expect(parsed).toMatchObject({
      hasSubscription: false,
      status: null,
      limitsUnlimited: false,
      discountPercent: 0,
      events: [],
      planLimits: {},
    })
  })

  it("reads events and skips malformed ones", () => {
    const parsed = tenantSubscriptionSchema.parse({
      tenantId: "t",
      hasSubscription: true,
      status: "active",
      events: [
        { id: "e1", type: "created", createdAt: "2026-11-01T10:00:00Z" },
        { type: "broken" },
      ],
    })
    expect(parsed.events).toEqual([{ id: "e1", type: "created", createdAt: "2026-11-01T10:00:00Z" }])
  })

  it("reads the billing summary and tolerates a missing breakdown", () => {
    expect(billingSummarySchema.parse({ mrrCents: 5000, activeCount: 2 })).toMatchObject({
      currency: "BRL",
      mrrCents: 5000,
      activeCount: 2,
      trialingCount: 0,
      byPackage: [],
    })
  })
})
