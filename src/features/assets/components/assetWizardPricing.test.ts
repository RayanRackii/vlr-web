import { describe, expect, it } from "vitest"

import { DAYS, emptyPricingEditor, expandPricingEditor, isPricingEditorValid, pricingEditorFromRows, type ExpandedPricingRow } from "./assetWizardPricing"

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

describe("per-day pricing round-trip (R11 retest)", () => {
  const base = { ...emptyPricingEditor(), pattern: "perDay" as const, startTime: "08:00", endTime: "22:00" }
  const weekendOnly = { ...base, perDayPrices: { ...base.perDayPrices, Sunday: 50, Saturday: 100 } }

  it("does not save blank per-day days as R$ 0 rows", () => {
    const rows = expandPricingEditor(weekendOnly)
    expect(rows.map((r) => [r.dayOfWeek, r.pricePerHour])).toEqual([["Sunday", 50], ["Saturday", 100]])
  })

  it("reopens weekend-only per-day prices in per-day mode", () => {
    const state = pricingEditorFromRows(expandPricingEditor({ ...base, perDayPrices: { ...base.perDayPrices, Sunday: 50, Saturday: 50 } }))
    expect(state.pattern).toBe("perDay")
    expect(state.perDayPrices.Sunday).toBe(50)
    expect(state.perDayPrices.Monday).toBe(0)
  })

  it("treats legacy R$ 0 rows as unset when reopening", () => {
    const legacy = DAYS.map((day) => row(day, "Hour", day === "Sunday" || day === "Saturday" ? 50 : 0))
    expect(pricingEditorFromRows(legacy).pattern).toBe("perDay")
  })
})
