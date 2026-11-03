import { describe, expect, it } from "vitest"
import {
  catalogOrderSchema,
  catalogProductResourceRequirementsResponseSchema,
} from "./catalogSchemas"

const legacyOrder = {
  id: "11111111-1111-4111-8111-111111111111",
  displayNumber: "PED-1",
  orderNumber: 1,
  status: "Requested",
  customerId: "22222222-2222-4222-8222-222222222222",
  customerName: "Ana",
  customerEmail: null,
  customerPhone: null,
  customerNote: null,
  totalAmount: 15,
  currency: "BRL",
  rejectedReason: null,
  cancelledReason: null,
  createdAt: "2026-10-28T12:00:00Z",
  items: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      productId: "44444444-4444-4444-8444-444444444444",
      productName: "Garrafa",
      productCode: null,
      unitPrice: 15,
      currency: "BRL",
      quantity: 1,
      subTotal: 15,
    },
  ],
  history: [],
}

describe("catalog order resource-planning fields", () => {
  it("defaults to the pre-planning contract when fields are absent", () => {
    const result = catalogOrderSchema.safeParse(legacyOrder)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.orderVersion).toBe("0")
    expect(result.data.planningRevision).toBe(0)
    expect(result.data.productionSummary).toBe("NotRequired")
    expect(result.data.estimatedReadyAt).toBeNull()
    expect(result.data.items[0].productionSummary).toBe("NotRequired")
    expect(result.data.items[0].allocation).toBeNull()
  })

  it("parses the new planning fields when present", () => {
    const result = catalogOrderSchema.safeParse({
      ...legacyOrder,
      orderVersion: "abc123",
      planningRevision: 3,
      productionSummary: "Scheduled",
      estimatedReadyAt: "2026-11-02T18:00:00Z",
      items: [
        {
          ...legacyOrder.items[0],
          productionSummary: "Scheduled",
          allocation: {
            id: "55555555-5555-4555-8555-555555555555",
            requirementId: "66666666-6666-4666-8666-666666666666",
            rentalAssetId: "77777777-7777-4777-8777-777777777777",
            status: "Scheduled",
            plannedWorkStart: "2026-11-02T14:00:00Z",
            plannedWorkEnd: "2026-11-02T15:00:00Z",
            timeZoneId: "America/Sao_Paulo",
            actualStartAt: null,
            actualWorkFinishedAt: null,
            actualReleaseAt: null,
            planningRevision: 1,
          },
        },
      ],
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.orderVersion).toBe("abc123")
    expect(result.data.planningRevision).toBe(3)
    expect(result.data.productionSummary).toBe("Scheduled")
    expect(result.data.estimatedReadyAt).toBe("2026-11-02T18:00:00Z")
    expect(result.data.items[0].allocation?.status).toBe("Scheduled")
  })
})

describe("catalog product resource requirements response", () => {
  it("parses an empty requirements list", () => {
    const result = catalogProductResourceRequirementsResponseSchema.safeParse({
      expectedVersion: 0,
      requirements: [],
    })
    expect(result.success).toBe(true)
  })

  it("parses a requirement row with a specific resource", () => {
    const result = catalogProductResourceRequirementsResponseSchema.safeParse({
      expectedVersion: 2,
      requirements: [
        {
          id: null,
          rentalAssetId: "77777777-7777-4777-8777-777777777777",
          assetCategoryId: null,
          resourceQuantity: 1,
          durationMinutesPerUnit: 60,
          prepMinutes: 5,
          cleanupMinutes: 5,
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})
