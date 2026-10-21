import { describe, expect, it } from "vitest"

import { shouldUseNewBookingUi } from "@/features/tenantPortal/lib/bookingUiRollout"

describe("booking UI rollout gate", () => {
  it("uses the new UI only for an enabled tenant without a legacy handoff", () => {
    expect(shouldUseNewBookingUi(true, null)).toBe(true)
    expect(shouldUseNewBookingUi(true, "0")).toBe(true)
    expect(shouldUseNewBookingUi(true, "1")).toBe(false)
  })

  it("keeps every legacy route unchanged while the flag is off", () => {
    expect(shouldUseNewBookingUi(false, null)).toBe(false)
    expect(shouldUseNewBookingUi(false, "1")).toBe(false)
    expect(shouldUseNewBookingUi(undefined, "1")).toBe(false)
  })
})
