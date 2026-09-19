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
    expect(parsed.data.assets[0]?.operationalStatus).toBe("Overdue")
    expect(parsed.data.assets[1]?.lastMaintenance).toBeNull()
    expect(parsed.data.assets[1]?.openWorkOrder?.status).toBe("InProgress")
  })

  it("accepts numeric operationalStatus 2 as Overdue", () => {
    const parsed = maintenancePlanCoverageSchema.safeParse({
      ...populatedCoverageJson,
      assets: [
        {
          ...populatedCoverageJson.assets[0],
          operationalStatus: 2,
        },
      ],
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.assets[0]?.operationalStatus).toBe("Overdue")
  })

  it("rejects DueSoon as an operational status", () => {
    const parsed = maintenancePlanCoverageSchema.safeParse({
      ...populatedCoverageJson,
      assets: [
        {
          ...populatedCoverageJson.assets[0],
          operationalStatus: "DueSoon",
        },
      ],
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects eligibleAssetCount that disagrees with summary.eligibleAssets", () => {
    const parsed = maintenancePlanCoverageSchema.safeParse({
      ...emptyCoverageJson,
      eligibleAssetCount: 4,
    })

    expect(parsed.success).toBe(false)
  })
})
