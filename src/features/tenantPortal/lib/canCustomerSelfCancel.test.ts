import { describe, expect, it } from "vitest"

import { canCustomerSelfCancel } from "@/features/tenantPortal/lib/canCustomerSelfCancel"

const NOW_MS = Date.parse("2026-09-07T15:00:00.000Z")
const FUTURE_ISO = "2026-09-07T16:00:00.000Z"
const PAST_ISO = "2026-09-07T14:00:00.000Z"
const EQUAL_ISO = "2026-09-07T15:00:00.000Z"

describe("canCustomerSelfCancel", () => {
  it("allows PendingDeposit when start is strictly in the future", () => {
    expect(canCustomerSelfCancel("PendingDeposit", FUTURE_ISO, NOW_MS)).toBe(
      true,
    )
  })

  it("allows Confirmed when start is strictly in the future", () => {
    expect(canCustomerSelfCancel("Confirmed", FUTURE_ISO, NOW_MS)).toBe(true)
  })

  it("hides Completed even when start is in the future", () => {
    expect(canCustomerSelfCancel("Completed", FUTURE_ISO, NOW_MS)).toBe(false)
  })

  it("hides Canceled even when start is in the future", () => {
    expect(canCustomerSelfCancel("Canceled", FUTURE_ISO, NOW_MS)).toBe(false)
  })

  it("hides Confirmed once the start instant has passed", () => {
    expect(canCustomerSelfCancel("Confirmed", PAST_ISO, NOW_MS)).toBe(false)
  })

  it("hides PendingDeposit once the start instant has passed", () => {
    expect(canCustomerSelfCancel("PendingDeposit", PAST_ISO, NOW_MS)).toBe(
      false,
    )
  })

  it("hides Confirmed when start equals now", () => {
    expect(canCustomerSelfCancel("Confirmed", EQUAL_ISO, NOW_MS)).toBe(false)
  })

  it("hides when the start instant cannot be parsed", () => {
    expect(canCustomerSelfCancel("Confirmed", "not-an-instant", NOW_MS)).toBe(
      false,
    )
  })
})
