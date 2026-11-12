import { describe, expect, it } from "vitest"

import { groupAssetsByHours } from "@/features/rentals/services/scheduleService"

describe("groupAssetsByHours", () => {
  it("keeps each resource on its own hours", () => {
    expect(groupAssetsByHours([
      { id: "a", openTime: "09:00:00", closeTime: "18:00:00" },
      { id: "b", openTime: "10:00:00", closeTime: "19:00:00" },
      { id: "c", openTime: "09:00:00", closeTime: "18:00:00" },
    ])).toEqual([
      { openTime: "09:00:00", closeTime: "18:00:00", ids: ["a", "c"] },
      { openTime: "10:00:00", closeTime: "19:00:00", ids: ["b"] },
    ])
  })

  it("refuses the batch when one resource has no hours", () => {
    expect(groupAssetsByHours([
      { id: "a", openTime: "09:00:00", closeTime: "18:00:00" },
      { id: "b", openTime: null, closeTime: null },
    ])).toBeNull()
  })
})
