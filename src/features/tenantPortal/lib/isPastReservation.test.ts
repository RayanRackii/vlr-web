import { describe, expect, it } from "vitest"

import { isPastReservation } from "@/features/tenantPortal/lib/isPastReservation"

const NOW_MS = Date.parse("2026-10-14T15:00:00.000Z")

describe("isPastReservation", () => {
  it("is past when the end instant is before or equal to now", () => {
    expect(isPastReservation("2026-10-14T14:00:00.000Z", NOW_MS)).toBe(true)
    expect(isPastReservation("2026-10-14T15:00:00.000Z", NOW_MS)).toBe(true)
  })

  it("is not past when the reservation is still open", () => {
    expect(isPastReservation("2026-10-14T16:00:00.000Z", NOW_MS)).toBe(false)
  })

  it("is not past when the end instant cannot be parsed", () => {
    expect(isPastReservation("not-an-instant", NOW_MS)).toBe(false)
  })
})
