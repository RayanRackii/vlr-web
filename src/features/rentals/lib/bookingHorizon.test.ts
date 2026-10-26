import { describe, expect, it } from "vitest"

import {
  addCivilDays,
  clampDateToHorizon,
  effectiveHorizonMaxDate,
  horizonEndDate,
  resolveAgendaHorizonDays,
} from "@/features/rentals/lib/bookingHorizon"

describe("booking horizon", () => {
  it("adds civil days without shifting the calendar date", () => {
    expect(addCivilDays("2026-10-16", 0)).toBe("2026-10-16")
    expect(addCivilDays("2026-10-16", 2)).toBe("2026-10-18")
    expect(addCivilDays("2026-12-31", 1)).toBe("2027-01-01")
  })

  it("caps at the furthest effective horizon and leaves unlimited open", () => {
    expect(
      resolveAgendaHorizonDays(
        [{ effectiveMaxAdvanceBookingDays: 7 }, { effectiveMaxAdvanceBookingDays: 30 }],
        7,
      ),
    ).toBe(30)
    expect(
      resolveAgendaHorizonDays(
        [{ effectiveMaxAdvanceBookingDays: 7 }, { effectiveMaxAdvanceBookingDays: null }],
        7,
      ),
    ).toBeNull()
    expect(resolveAgendaHorizonDays([], undefined)).toBeUndefined()
    expect(resolveAgendaHorizonDays([], 14)).toBe(14)
    expect(resolveAgendaHorizonDays([], null)).toBeNull()
    expect(horizonEndDate("2026-10-16", 14)).toBe("2026-10-30")
    expect(horizonEndDate("2026-10-16", null)).toBeNull()
    expect(clampDateToHorizon("2099-12-31", "2026-10-30")).toBe("2026-10-30")
    expect(clampDateToHorizon("2026-10-20", "2026-10-30")).toBe("2026-10-20")
  })

  it("withholds the horizon until resources finish loading, instead of clamping to a narrower, load-order-dependent date", () => {
    // Before resources load, a global policy-only horizon (e.g. 7 days) must not
    // clamp a deep link that a wider resource-specific horizon (e.g. 30 days) would
    // have allowed — the clamp is deterministic only once resources are in.
    expect(effectiveHorizonMaxDate(false, "2026-10-25", 7)).toBeNull()
    expect(effectiveHorizonMaxDate(true, "2026-10-25", 30)).toBe("2026-11-24")
    expect(effectiveHorizonMaxDate(true, "2026-10-25", null)).toBeNull()
  })
})
