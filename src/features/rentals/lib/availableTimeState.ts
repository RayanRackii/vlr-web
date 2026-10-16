export type AvailableTimeReason =
  | "loading"
  | "error"
  | "closed"
  | "noHours"
  | "noneOpen"
  | "pastOnly"
  | "ready"

export type AvailableTimeSlot = {
  occupancyKindKey: string
  status: string
  reservationId?: string | null
  startTime: string
}

export function isClosedOccupancy(slot: { occupancyKindKey: string }): boolean {
  return slot.occupancyKindKey.trim().toLowerCase() === "closed"
}

/**
 * Why the staff "available time" control has nothing to pick.
 *
 * `GET /api/schedule/days/{date}` is `{ date, slots }` for the civil date the
 * form already sent. It has no closed-day or missing-hours flag, and the
 * client does not derive a weekday from the date. An empty `slots` array is
 * a weekday with no weekly template and no persisted interval. A day whose
 * every slot uses the `closed` kind is a closure. Slots that exist but are
 * not open (lessons, reservations) are a third empty result.
 */
export function explainAvailableTime(input: {
  resourcesPending: boolean
  hasResource: boolean
  dayStatus: "idle" | "loading" | "ready" | "error"
  slots: readonly AvailableTimeSlot[] | null
  openCount: number
  offerableCount: number
}): AvailableTimeReason {
  if (input.resourcesPending) {
    return "loading"
  }
  if (!input.hasResource) {
    return "ready"
  }
  if (input.dayStatus === "loading" || input.dayStatus === "idle") {
    return "loading"
  }
  if (input.dayStatus === "error" || input.slots === null) {
    return "error"
  }
  if (input.offerableCount > 0) {
    return "ready"
  }
  if (input.openCount > 0) {
    return "pastOnly"
  }
  if (input.slots.length === 0) {
    return "noHours"
  }
  if (input.slots.every(isClosedOccupancy)) {
    return "closed"
  }
  return "noneOpen"
}
