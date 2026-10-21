import { describe, expect, it } from "vitest"

import { newBookingHandoffSearchParams } from "@/features/tenantPortal/lib/newBookingHandoff"

describe("new booking handoff", () => {
  it("carries the resource, complete interval, and selected quantity", () => {
    const params = newBookingHandoffSearchParams(
      new URLSearchParams("reservation=known"),
      "2026-11-18",
      {
        rentalAssetId: "11111111-1111-4111-8111-111111111111",
        startTime: "10:00:00",
        endTime: "11:30:00",
        quantity: 3,
      },
    )

    expect(params.toString()).toContain("reservation=known")
    expect(params.get("legacyBooking")).toBe("1")
    expect(params.get("date")).toBe("2026-11-18")
    expect(params.get("rentalAssetId")).toBe("11111111-1111-4111-8111-111111111111")
    expect(params.get("time")).toBe("10:00")
    expect(params.get("endTime")).toBe("11:30")
    expect(params.get("quantity")).toBe("3")
  })
})
