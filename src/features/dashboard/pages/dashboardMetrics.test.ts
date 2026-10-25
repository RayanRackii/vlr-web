import { describe, expect, it } from "vitest"

import { hasSlotsToday, reservationsTodayTotal } from "@/features/dashboard/pages/dashboardMetrics"

describe("reservationsTodayTotal", () => {
  it("excludes cancelled bookings from the total", () => {
    const total = reservationsTodayTotal({
      reservationsTodayPendingDeposit: 2,
      reservationsTodayConfirmed: 3,
      reservationsTodayCompleted: 1,
    })

    expect(total).toBe(6)
  })
})

describe("hasSlotsToday", () => {
  it("is false when there is nothing available or booked (OpenHours resources)", () => {
    expect(hasSlotsToday({ slotsAvailableToday: 0, slotsBookedToday: 0 })).toBe(false)
  })

  it("is true when there is any available or booked slot", () => {
    expect(hasSlotsToday({ slotsAvailableToday: 5, slotsBookedToday: 0 })).toBe(true)
    expect(hasSlotsToday({ slotsAvailableToday: 0, slotsBookedToday: 2 })).toBe(true)
  })
})
