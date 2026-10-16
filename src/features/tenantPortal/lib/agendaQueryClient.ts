import { toast } from "sonner"

import {
  agendaRefreshDates,
  agendaReservedSlotKey,
  isBlockingReservationStatus,
  reservationCivilStart,
  reservedSlotKeysForDate,
  retryOnce,
  type AgendaReservationHold,
} from "@/features/tenantPortal/lib/agendaReservationQuery"
import { isSlotTakenConflict } from "@/features/tenantPortal/lib/portalBookingError"
import {
  fetchPublicScheduleDay,
  listMyPortalReservations,
  type PortalDaySchedule,
  type PortalReservation,
} from "@/features/tenantPortal/services/tenantPortalService"
import appI18n from "@/lib/i18n"

export type AgendaDaySnapshot = {
  dayDate: string
  day: PortalDaySchedule
}

export type AgendaQuerySnapshot = {
  revision: number
  subdomain: string
  applySlots: boolean
  reservations: PortalReservation[]
  days: AgendaDaySnapshot[]
}

export type AgendaInvalidateScope = {
  subdomain: string
  dates: readonly string[]
}

type AgendaInvalidateOptions = {
  applySlots: boolean
}

type Listener = (snapshot: AgendaQuerySnapshot) => void

let revision = 0
const listeners = new Set<Listener>()
const ownSlotKeys = new Set<string>()

function reportRefreshError(error: unknown): void {
  toast.error(
    error instanceof Error
      ? error.message
      : appI18n.t("tenantPortal.agenda.slotsError"),
  )
}

function uniqueDates(dates: readonly string[]): string[] {
  return [...new Set(dates.map((value) => value.trim()).filter((value) => value.length > 0))]
}

async function loadAgendaDays(
  subdomain: string,
  dates: readonly string[],
): Promise<{ reservations: PortalReservation[]; days: AgendaDaySnapshot[] }> {
  const [reservations, days] = await Promise.all([
    listMyPortalReservations(),
    Promise.all(
      dates.map(async (dayDate) => {
        const day = await fetchPublicScheduleDay(subdomain, dayDate)
        return { dayDate, day }
      }),
    ),
  ])
  return { reservations, days }
}

/**
 * Refetch bookings and slot availability outside any component lifecycle.
 * A listener that subscribes while the request is in flight still receives
 * the snapshot. A newer invalidation wins over an older in-flight response.
 */
export function invalidateAgendaQueries(
  scope: AgendaInvalidateScope,
  options: AgendaInvalidateOptions,
): Promise<void> {
  const subdomain = scope.subdomain.trim()
  const dates = uniqueDates(scope.dates)
  if (subdomain.length === 0 || dates.length === 0) {
    return Promise.resolve()
  }

  const token = ++revision
  return retryOnce(() => loadAgendaDays(subdomain, dates))
    .then((loaded) => {
      if (token !== revision) {
        return
      }
      releaseCancelledOwnSlots(loaded.reservations)
      const snapshot: AgendaQuerySnapshot = {
        revision: token,
        subdomain,
        applySlots: options.applySlots,
        reservations: loaded.reservations,
        days: loaded.days,
      }
      for (const listener of [...listeners]) {
        listener(snapshot)
      }
    })
    .catch((error: unknown) => {
      if (token !== revision || !options.applySlots) {
        return
      }
      reportRefreshError(error)
    })
}

export function subscribeAgendaQueries(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAgendaQueryRevision(): number {
  return revision
}

/**
 * Keep rows this page already has that the snapshot does not list, then take
 * the snapshot. A stale response must not wipe a booking the subscriber just
 * added.
 */
export function mergeServerReservations<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const serverIds = new Set(incoming.map((row) => row.id))
  const onlyLocal = current.filter((row) => !serverIds.has(row.id))
  return [...onlyLocal, ...incoming]
}

/** A refresh that shows the booking cancelled must stop blocking that slot. */
export function releaseCancelledOwnSlots(
  reservations: readonly {
    status: string
    startDateTime: string
    items: readonly { rentalAssetId: string }[]
  }[],
): void {
  for (const reservation of reservations) {
    const normalized = reservation.status.trim().toLowerCase()
    if (normalized === "cancelled" || normalized === "canceled") {
      forgetOwnBooking(reservation)
    }
  }
}

function ownKeysFor(reservation: {
  startDateTime: string
  items: readonly { rentalAssetId: string }[]
}): string[] {
  const civil = reservationCivilStart(reservation.startDateTime)
  if (civil === null) {
    return []
  }

  const keys: string[] = []
  for (const item of reservation.items) {
    if (item.rentalAssetId.length === 0) {
      continue
    }
    keys.push(agendaReservedSlotKey(civil.date, item.rentalAssetId, civil.time))
  }
  return keys
}

/** Remember a booking this browser just created, even if the page unmounted. */
export function rememberOwnBooking(reservation: PortalReservation): void {
  if (!isBlockingReservationStatus(reservation.status)) {
    return
  }
  for (const key of ownKeysFor(reservation)) {
    ownSlotKeys.add(key)
  }
}

export function forgetOwnBooking(reservation: {
  startDateTime: string
  items: readonly { rentalAssetId: string }[]
}): void {
  for (const key of ownKeysFor(reservation)) {
    ownSlotKeys.delete(key)
  }
}

export function isOwnBookedSlot(
  date: string,
  rentalAssetId: string,
  startTime: string,
): boolean {
  return ownSlotKeys.has(agendaReservedSlotKey(date, rentalAssetId, startTime))
}

/**
 * True when this customer already holds the slot: either the mutation in this
 * browser just created it, or Minhas reservas already lists it.
 */
export function customerAlreadyHoldsSlot(
  date: string,
  rentalAssetId: string,
  startTime: string,
  reservations: readonly AgendaReservationHold[],
): boolean {
  if (isOwnBookedSlot(date, rentalAssetId, startTime)) {
    return true
  }

  const key = agendaReservedSlotKey(date, rentalAssetId, startTime)
  return reservedSlotKeysForDate(date, reservations, []).has(key)
}

/**
 * Booking mutation. The refetch lives here, not in a component callback, so
 * Back during "Reservando…" still updates whoever is subscribed. A 409 that
 * says the interval is already reserved refetches too. Other failures do not
 * replace the slot list (daily limit, queue, unavailable).
 */
export async function commitPortalBooking<T extends PortalReservation>(
  request: () => Promise<T>,
  scope: AgendaInvalidateScope,
): Promise<T> {
  try {
    const created = await request()
    rememberOwnBooking(created)
    const viewed = scope.dates[0] ?? ""
    void invalidateAgendaQueries(
      {
        subdomain: scope.subdomain,
        dates: agendaRefreshDates(viewed, [created]),
      },
      { applySlots: true },
    )
    return created
  } catch (error) {
    if (isSlotTakenConflict(error)) {
      void invalidateAgendaQueries(scope, { applySlots: true })
    }
    throw error
  }
}

export function resetAgendaQueryClientForTests(): void {
  revision += 1
  listeners.clear()
  ownSlotKeys.clear()
}
