import { describe, expect, it } from "vitest"

import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import {
  generateWorkOrderFromPlanRequestSchema,
  workOrderSchema,
} from "@/features/workOrders/schemas/workOrderSchemas"

describe("workOrderSchema sourcePlanName", () => {
  it("keeps historical sourcePlanName from the API snapshot", () => {
    const parsed = workOrderSchema.parse({
      ...makeWorkOrder(),
      sourcePlanName: "Nome histórico do plano",
    })

    expect(parsed.sourcePlanName).toBe("Nome histórico do plano")
    expect(parsed.maintenancePlanId).toBe(PLAN_ID)
  })

  it("accepts missing or null sourcePlanName without rewriting it", () => {
    const withoutField = { ...makeWorkOrder() }
    delete (withoutField as { sourcePlanName?: string | null }).sourcePlanName

    expect(workOrderSchema.parse(withoutField).sourcePlanName).toBeUndefined()
    expect(workOrderSchema.parse({ ...makeWorkOrder(), sourcePlanName: null }).sourcePlanName).toBeNull()
  })
})

describe("generateWorkOrderFromPlanRequestSchema", () => {
  it("requires planId, assetId and scheduledDate and allows a null technician", () => {
    const parsed = generateWorkOrderFromPlanRequestSchema.parse({
      planId: PLAN_ID,
      assetId: "12121212-1212-4121-8121-121212121212",
      assignedUserId: null,
      scheduledDate: "2026-09-18",
    })

    expect(parsed).toEqual({
      planId: PLAN_ID,
      assetId: "12121212-1212-4121-8121-121212121212",
      assignedUserId: null,
      scheduledDate: "2026-09-18",
    })
  })
})
