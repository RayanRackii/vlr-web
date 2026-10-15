import { z } from "zod"

const reservationIdSchema = z.string().uuid()

const CANCELED_STATUSES = new Set(["canceled", "cancelled"])

/**
 * `?reservation=` from the booking email (`/t/{subdomain}/agenda?reservation={id}`).
 * Anything that is not a UUID is ignored.
 */
export function parseAgendaReservationQuery(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null
  }

  const parsed = reservationIdSchema.safeParse(value.trim())
  if (!parsed.success) {
    return null
  }

  return parsed.data.toLowerCase()
}

type AgendaReservationCandidate = {
  id: string
  status: string
}

function isCanceledStatus(status: string): boolean {
  return CANCELED_STATUSES.has(status.trim().toLowerCase())
}

/**
 * Select a reservation from the customer's own Minhas reservas list.
 * The list is the ownership boundary: ids that are absent (missing, foreign,
 * other tenant) are not selectable. Canceled rows stay in that list but are
 * not opened from the email link.
 */
export function findVisibleAgendaReservation<T extends AgendaReservationCandidate>(
  reservations: readonly T[],
  reservationId: string | null,
): T | null {
  if (reservationId === null) {
    return null
  }

  const needle = reservationId.toLowerCase()
  const match = reservations.find(
    (reservation) => reservation.id.toLowerCase() === needle,
  )
  if (!match || isCanceledStatus(match.status)) {
    return null
  }

  return match
}
