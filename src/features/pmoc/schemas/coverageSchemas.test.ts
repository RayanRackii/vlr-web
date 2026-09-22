import { describe, expect, it } from "vitest"

import { maintenancePlanCoverageSchema } from "@/features/pmoc/schemas/coverageSchemas"
import {
  emptyCoverageJson,
  populatedCoverageJson,
} from "@/features/pmoc/test/coverageFixtures"

describe("maintenancePlanCoverageSchema", () => {
  it("B: accepts a valid coverage DTO", () => {
    const parsed = maintenancePlanCoverageSchema.safeParse(populatedCoverageJson)

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.eligibleAssetCount).toBe(3)
    expect(parsed.data.summary.assetsOverdue).toBe(1)
    expect(parsed.data.assets[0]?.dueStatus).toBe("Overdue")
    expect(parsed.data.assets[1]?.lastMaintenance).toBeNull()
    expect(parsed.data.assets[1]?.openWorkOrder?.status).toBe("InProgress")
  })

  it("accepts numeric dueStatus 2 as Overdue", () => {
    const parsed = maintenancePlanCoverageSchema.safeParse({
      ...populatedCoverageJson,
      assets: [
        {
          ...populatedCoverageJson.assets[0],
          dueStatus: 2,
        },
      ],
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.assets[0]?.dueStatus).toBe("Overdue")
  })

  it("rejects DueSoon and operationalStatus", () => {
    const withDueSoon = maintenancePlanCoverageSchema.safeParse({
      ...populatedCoverageJson,
      assets: [
        {
          ...populatedCoverageJson.assets[0],
          dueStatus: "DueSoon",
        },
      ],
    })
    const withOperational = maintenancePlanCoverageSchema.safeParse({
      ...populatedCoverageJson,
      assets: [
        {
          ...populatedCoverageJson.assets[0],
          operationalStatus: "Overdue",
        },
      ],
    })

    expect(withDueSoon.success).toBe(false)
    if (withOperational.success) {
      expect(withOperational.data.assets[0]).not.toHaveProperty("operationalStatus")
    }
  })

  it("rejects eligibleAssetCount that disagrees with summary.eligibleAssets", () => {
    const parsed = maintenancePlanCoverageSchema.safeParse({
      ...emptyCoverageJson,
      eligibleAssetCount: 4,
    })

    expect(parsed.success).toBe(false)
  })
})
