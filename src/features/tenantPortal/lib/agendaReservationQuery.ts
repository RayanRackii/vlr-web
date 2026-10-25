import { z } from "zod"

import {
  DEFAULT_TENANT_TIME_ZONE,
  tenantCivilDateTime,
} from "@/lib/tenantTimeZone"

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

const BLOCKING_RESERVATION_STATUSES = new Set(["pendingdeposit", "confirmed"])

export type AgendaReservationHold = {
  id: string
  status: string
  startDateTime: string
  items: readonly { rentalAssetId: string; quantity?: number }[]
}

export type AgendaSlotHold = {
  rentalAssetId: string
  startTime: string
  reservationId?: string | null
  isBookableByCustomer: boolean
  status: string
}

/** PendingDeposit and Confirmed still occupy the slot. Canceled does not. */
export function isBlockingReservationStatus(status: string): boolean {
  return BLOCKING_RESERVATION_STATUSES.has(status.trim().toLowerCase())
}

function clockKey(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

/**
 * One civil date plus one rental asset plus one start clock.
 * A key from Monday cannot paint Tuesday.
 */
export function agendaReservedSlotKey(
  date: string,
  rentalAssetId: string,
  startTime: string,
): string {
  return `${date}:${rentalAssetId}|${clockKey(startTime)}`
}

/** Start of a reservation on the Rolvix clock, or null when the instant is unreadable. */
export function reservationCivilStart(
  startDateTime: string,
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): { date: string; time: string } | null {
  const instant = new Date(startDateTime)
  if (Number.isNaN(instant.getTime())) {
    return null
  }

  const civil = tenantCivilDateTime(instant, timeZoneId)
  return { date: civil.date, time: clockKey(civil.time) }
}

export function reservationCivilDate(
  startDateTime: string,
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): string | null {
  return reservationCivilStart(startDateTime, timeZoneId)?.date ?? null
}

function isBookableObservation(slot: AgendaSlotHold): boolean {
  return (
    slot.isBookableByCustomer && slot.status.toLowerCase() === "available"
  )
}

/**
 * Slots this customer still holds on `date`.
 * A blocking reservation contributes its asset and start clock.
 * A non-bookable schedule row contributes when its reservationId is one of
 * those blocking reservations. Canceled rows and other customers do not.
 */
export function reservedSlotKeysForDate(
  date: string,
  reservations: readonly AgendaReservationHold[],
  slots: readonly AgendaSlotHold[],
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): ReadonlySet<string> {
  const blocking = reservations.filter((reservation) =>
    isBlockingReservationStatus(reservation.status),
  )
  const blockingIds = new Set(
    blocking.map((reservation) => reservation.id.toLowerCase()),
  )
  const keys = new Set<string>()

  for (const reservation of blocking) {
    const civil = reservationCivilStart(reservation.startDateTime, timeZoneId)
    if (civil === null || civil.date !== date) {
      continue
    }

    for (const item of reservation.items) {
      if (item.rentalAssetId.length === 0) {
        continue
      }
      keys.add(agendaReservedSlotKey(date, item.rentalAssetId, civil.time))
    }
  }

  for (const slot of slots) {
    const reservationId = slot.reservationId?.trim().toLowerCase() ?? ""
    if (reservationId.length === 0 || !blockingIds.has(reservationId)) {
      continue
    }
    if (isBookableObservation(slot)) {
      continue
    }
    keys.add(agendaReservedSlotKey(date, slot.rentalAssetId, slot.startTime))
  }

  return keys
}

/** Units this customer holds for an active reservation at this slot. */
export function customerHeldSlotQuantity(
  date: string,
  rentalAssetId: string,
  startTime: string,
  reservations: readonly AgendaReservationHold[],
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): number {
  const key = agendaReservedSlotKey(date, rentalAssetId, startTime)
  let quantity = 0

  for (const reservation of reservations) {
    if (!isBlockingReservationStatus(reservation.status)) {
      continue
    }
    const civil = reservationCivilStart(reservation.startDateTime, timeZoneId)
    if (civil === null || civil.date !== date) {
      continue
    }
    for (const item of reservation.items) {
      if (agendaReservedSlotKey(date, item.rentalAssetId, civil.time) === key) {
        quantity += item.quantity ?? 1
      }
    }
  }

  return quantity
}

/** Drop optimistic marks once the server lists that slot as bookable on `date`. */
export function withoutBookableReservedKeys(
  keys: ReadonlySet<string>,
  date: string,
  bookableSlots: readonly { rentalAssetId: string; startTime: string }[],
): ReadonlySet<string> {
  if (keys.size === 0 || bookableSlots.length === 0) {
    return keys
  }

  const bookable = new Set(
    bookableSlots.map((slot) =>
      agendaReservedSlotKey(date, slot.rentalAssetId, slot.startTime),
    ),
  )
  let changed = false
  const next = new Set<string>()
  for (const key of keys) {
    if (bookable.has(key)) {
      changed = true
      continue
    }
    next.add(key)
  }

  return changed ? next : keys
}

/** Viewed date plus each reservation's civil date, without duplicates. */
export function agendaRefreshDates(
  viewedDate: string,
  reservations: readonly { startDateTime: string }[],
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): string[] {
  const dates: string[] = []
  const seen = new Set<string>()

  const add = (value: string | null) => {
    if (value === null || value.length === 0 || seen.has(value)) {
      return
    }
    seen.add(value)
    dates.push(value)
  }

  add(viewedDate)
  for (const reservation of reservations) {
    add(reservationCivilDate(reservation.startDateTime, timeZoneId))
  }

  return dates
}

/** Run once, and exactly once more after a failure. The second failure propagates. */
export async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch {
    return await operation()
  }
}
