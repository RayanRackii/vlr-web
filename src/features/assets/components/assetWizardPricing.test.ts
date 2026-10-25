import { describe, expect, it } from "vitest"

import { expandPricingEditor, pricingEditorFromRows, type ExpandedPricingRow } from "./assetWizardPricing"

const row = (dayOfWeek: ExpandedPricingRow["dayOfWeek"], pricingUnit: ExpandedPricingRow["pricingUnit"], pricePerHour = 50): ExpandedPricingRow => ({
  dayOfWeek, pricingUnit, startTime: "08:00", endTime: "22:00", pricePerHour,
})

describe("pricing units on wizard reload", () => {
  it("keeps per-row units when loaded rows disagree", () => {
    const state = pricingEditorFromRows([row("Monday", "Hour"), row("Saturday", "Day", 300)])
    const expanded = expandPricingEditor(state)
    expect(expanded.find((r) => r.dayOfWeek === "Monday")?.pricingUnit).toBe("Hour")
    expect(expanded.find((r) => r.dayOfWeek === "Saturday")?.pricingUnit).toBe("Day")
  })

  it("applies the chosen unit to every row once the user picks one", () => {
    const state = pricingEditorFromRows([row("Monday", "Hour"), row("Saturday", "Day", 300)])
    const expanded = expandPricingEditor({ ...state, pricingUnit: "Slot", perDayUnits: null })
    expect(new Set(expanded.map((r) => r.pricingUnit))).toEqual(new Set(["Slot"]))
  })

  it("uses a single unit when rows agree", () => {
    const state = pricingEditorFromRows([row("Monday", "Fixed"), row("Tuesday", "Fixed")])
    expect(state.perDayUnits).toBeNull()
    expect(expandPricingEditor(state).every((r) => r.pricingUnit === "Fixed")).toBe(true)
  })
})
