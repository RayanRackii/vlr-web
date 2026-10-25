import { describe, expect, it } from "vitest"

import { emptyPricingEditor, expandPricingEditor, isPricingEditorValid, pricingEditorFromRows, type ExpandedPricingRow } from "./assetWizardPricing"

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

describe("isPricingEditorValid price rules (R11)", () => {
  const base = { ...emptyPricingEditor(), startTime: "08:00", endTime: "22:00" }
  it("rejects 0, NaN and over-cap for a single price", () => {
    expect(isPricingEditorValid({ ...base, everydayPrice: 0 })).toBe(false)
    expect(isPricingEditorValid({ ...base, everydayPrice: Number.NaN })).toBe(false)
    expect(isPricingEditorValid({ ...base, everydayPrice: 2_000_000 })).toBe(false)
    expect(isPricingEditorValid({ ...base, everydayPrice: 12.5 })).toBe(true)
  })
  it("per day keeps blank days but rejects invalid typed days", () => {
    const perDayPrices = { ...base.perDayPrices, Monday: 45 }
    expect(isPricingEditorValid({ ...base, pattern: "perDay", perDayPrices })).toBe(true)
    expect(isPricingEditorValid({ ...base, pattern: "perDay", perDayPrices: { ...perDayPrices, Tuesday: Number.NaN } })).toBe(false)
    expect(isPricingEditorValid({ ...base, pattern: "perDay", perDayPrices: base.perDayPrices })).toBe(false)
  })
})
