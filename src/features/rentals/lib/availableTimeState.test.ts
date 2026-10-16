import { describe, expect, it } from "vitest"

import { explainAvailableTime } from "@/features/rentals/lib/availableTimeState"

const closedSlot = {
  occupancyKindKey: "closed",
  status: "Available",
  reservationId: null,
  startTime: "08:00:00",
}

const openSlot = {
  occupancyKindKey: "open",
  status: "Available",
  reservationId: null,
  startTime: "10:00:00",
}

const lessonSlot = {
  occupancyKindKey: "lesson",
  status: "Available",
  reservationId: null,
  startTime: "11:00:00",
}

describe("explainAvailableTime", () => {
  it("stays on loading while resources or the day request are in flight", () => {
    expect(
      explainAvailableTime({
        resourcesPending: true,
        hasResource: false,
        dayStatus: "idle",
        slots: null,
        openCount: 0,
        offerableCount: 0,
      }),
    ).toBe("loading")
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "loading",
        slots: null,
        openCount: 0,
        offerableCount: 0,
      }),
    ).toBe("loading")
  })

  it("surfaces a failed day read instead of an empty control", () => {
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "error",
        slots: null,
        openCount: 0,
        offerableCount: 0,
      }),
    ).toBe("error")
  })

  it("treats a ready day with no slots as hours that were never configured", () => {
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "ready",
        slots: [],
        openCount: 0,
        offerableCount: 0,
      }),
    ).toBe("noHours")
  })

  it("treats a day of only closed slots as a closure", () => {
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "ready",
        slots: [closedSlot, { ...closedSlot, startTime: "09:00:00" }],
        openCount: 0,
        offerableCount: 0,
      }),
    ).toBe("closed")
  })

  it("does not call a lesson-only or reserved day a closure or a missing grid", () => {
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "ready",
        slots: [lessonSlot, { ...openSlot, status: "Booked", reservationId: "reserved" }],
        openCount: 0,
        offerableCount: 0,
      }),
    ).toBe("noneOpen")
  })

  it("keeps past open intervals distinct from a day with no hours", () => {
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "ready",
        slots: [openSlot],
        openCount: 1,
        offerableCount: 0,
      }),
    ).toBe("pastOnly")
  })

  it("offers the control when an open interval remains", () => {
    expect(
      explainAvailableTime({
        resourcesPending: false,
        hasResource: true,
        dayStatus: "ready",
        slots: [openSlot, closedSlot],
        openCount: 1,
        offerableCount: 1,
      }),
    ).toBe("ready")
  })
})
