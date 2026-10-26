import { describe, expect, it } from "vitest"
import { unitPriceForWindow } from "./pricingUnitText"

describe("unitPriceForWindow", () => {
  it("divides by hours and quantity for Hour", () => {
    expect(unitPriceForWindow({ startTime: "08:00:00", endTime: "10:00:00", totalAmount: 240, pricingUnit: "Hour", quantity: 2 })).toEqual({ amount: 60, unit: "Hour" })
  })
  it("uses billed days for Day", () => {
    expect(unitPriceForWindow({ startTime: "08:00:00", endTime: "09:00:00", totalAmount: 180, pricingUnit: "Day", days: 3, quantity: 2 })).toEqual({ amount: 30, unit: "Day" })
  })
  it("returns null without a price", () => {
    expect(unitPriceForWindow({ startTime: "08:00:00", endTime: "09:00:00", totalAmount: null })).toBeNull()
  })
  it("does not split a Fixed price across quantity — it is flat for the whole booking", () => {
    expect(
      unitPriceForWindow({ startTime: "08:00:00", endTime: "09:00:00", totalAmount: 30, pricingUnit: "Fixed", quantity: 2 }),
    ).toEqual({ amount: 30, unit: "Fixed" })
  })
})
