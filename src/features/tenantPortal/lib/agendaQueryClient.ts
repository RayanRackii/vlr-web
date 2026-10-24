import { PortalSessionExpiredError, notifyPortalSessionExpired } from "./portalSessionError"
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
import {
  describeBookingError,
  isSlotTakenConflict,
} from "@/features/tenantPortal/lib/portalBookingError"
import {
  fetchPublicScheduleDay,
  listMyPortalReservations,
  type PortalDaySchedule,
  type PortalReservation,
} from "@/features/tenantPortal/services/tenantPortalService"
import appI18n from "@/lib/i18n"
import { DEFAULT_TENANT_TIME_ZONE } from "@/lib/tenantTimeZone"

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
  timeZoneId?: string
}

type AgendaInvalidateOptions = {
  applySlots: boolean
}

type Listener = (snapshot: AgendaQuerySnapshot) => void

let revision = 0
let sessionGeneration = 0
const listeners = new Set<Listener>()
const ownSlotKeys = new Set<string>()
const recentBySubdomain = new Map<string, PortalReservation[]>()
const inflightBySlot = new Map<string, Promise<PortalReservation>>()

export type PortalBookingSlot = {
  date: string
  rentalAssetId: string
  startTime: string
}

function subdomainKey(subdomain: string): string {
  return subdomain.trim().toLowerCase()
}

function isCancelledStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === "cancelled" || normalized === "canceled"
}

export function recentPortalReservations(subdomain: string): PortalReservation[] {
  return recentBySubdomain.get(subdomainKey(subdomain)) ?? []
}

function rememberRecentReservation(
  subdomain: string,
  created: PortalReservation,
): void {
  const key = subdomainKey(subdomain)
  const current = recentBySubdomain.get(key) ?? []
  recentBySubdomain.set(key, [
    created,
    ...current.filter((row) => row.id !== created.id),
  ])
}

/** A cancel in this browser must not be restored by a later empty list read. */
export function forgetRecentReservation(reservationId: string): void {
  for (const [key, rows] of recentBySubdomain) {
    const next = rows.filter((row) => row.id !== reservationId)
    if (next.length !== rows.length) {
      recentBySubdomain.set(key, next)
    }
  }
}

function syncRecentReservations(
  subdomain: string,
  incoming: readonly PortalReservation[],
): void {
  const key = subdomainKey(subdomain)
  const current = recentBySubdomain.get(key)
  if (!current || current.length === 0) {
    return
  }

  const incomingById = new Map(incoming.map((row) => [row.id, row]))
  const next: PortalReservation[] = []
  for (const row of current) {
    const fresh = incomingById.get(row.id)
    if (!fresh) {
      next.push(row)
      continue
    }
    if (!isCancelledStatus(fresh.status)) {
      next.push(fresh)
    }
  }
  recentBySubdomain.set(key, next)
}

export function isPortalBookingInFlight(
  date: string,
  rentalAssetId: string,
  startTime: string,
): boolean {
  return inflightBySlot.has(agendaReservedSlotKey(date, rentalAssetId, startTime))
}

function reportRefreshError(error: unknown): void {
  if (error instanceof PortalSessionExpiredError) {
    notifyPortalSessionExpired()
    return
  }
  toast.error(
    describeBookingError(error, appI18n.t("tenantPortal.agenda.slotsError")),
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
  const generation = sessionGeneration
  return retryOnce(() => {
    if (generation !== sessionGeneration) {
      throw new DOMException("Customer session changed", "AbortError")
    }
    return loadAgendaDays(subdomain, dates)
  })
    .then((loaded) => {
      if (token !== revision) {
        return
      }
      releaseCancelledOwnSlots(loaded.reservations, scope.timeZoneId)
      syncRecentReservations(subdomain, loaded.reservations)
      const snapshot: AgendaQuerySnapshot = {
        revision: token,
        subdomain,
        applySlots: options.applySlots,
        reservations: mergeServerReservations(
          recentPortalReservations(subdomain),
          loaded.reservations,
        ),
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

export function getAgendaSessionGeneration(): number {
  return sessionGeneration
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
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): void {
  for (const reservation of reservations) {
    const normalized = reservation.status.trim().toLowerCase()
    if (normalized === "cancelled" || normalized === "canceled") {
      forgetOwnBooking(reservation, timeZoneId)
    }
  }
}

function ownKeysFor(reservation: {
  startDateTime: string
  items: readonly { rentalAssetId: string }[]
}, timeZoneId: string = DEFAULT_TENANT_TIME_ZONE): string[] {
  const civil = reservationCivilStart(reservation.startDateTime, timeZoneId)
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
export function rememberOwnBooking(
  reservation: PortalReservation,
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): void {
  if (!isBlockingReservationStatus(reservation.status)) {
    return
  }
  for (const key of ownKeysFor(reservation, timeZoneId)) {
    ownSlotKeys.add(key)
  }
}

export function forgetOwnBooking(reservation: {
  startDateTime: string
  items: readonly { rentalAssetId: string }[]
}, timeZoneId: string = DEFAULT_TENANT_TIME_ZONE): void {
  for (const key of ownKeysFor(reservation, timeZoneId)) {
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
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): boolean {
  if (isOwnBookedSlot(date, rentalAssetId, startTime)) {
    return true
  }

  const key = agendaReservedSlotKey(date, rentalAssetId, startTime)
  return reservedSlotKeysForDate(date, reservations, [], timeZoneId).has(key)
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
  slot?: PortalBookingSlot,
): Promise<T> {
  const generation = sessionGeneration
  const flightKey = slot
    ? agendaReservedSlotKey(slot.date, slot.rentalAssetId, slot.startTime)
    : null
  if (flightKey) {
    const existing = inflightBySlot.get(flightKey)
    if (existing) {
      return existing as Promise<T>
    }
  }

  let resolveRun: (value: T) => void = () => undefined
  let rejectRun: (reason: unknown) => void = () => undefined
  const run = new Promise<T>((resolve, reject) => {
    resolveRun = resolve
    rejectRun = reject
  })
  if (flightKey) {
    inflightBySlot.set(flightKey, run)
  }

  void (async () => {
    try {
      const created = await request()
      if (generation !== sessionGeneration) {
        throw new DOMException("Customer session changed", "AbortError")
      }
      rememberOwnBooking(created, scope.timeZoneId)
      rememberRecentReservation(scope.subdomain, created)
      const viewed = scope.dates[0] ?? ""
      void invalidateAgendaQueries(
        {
          subdomain: scope.subdomain,
          dates: agendaRefreshDates(viewed, [created], scope.timeZoneId),
          timeZoneId: scope.timeZoneId,
        },
        { applySlots: true },
      )
      resolveRun(created)
    } catch (error) {
      if (generation !== sessionGeneration) {
        rejectRun(new DOMException("Customer session changed", "AbortError"))
        return
      }
      if (isSlotTakenConflict(error)) {
        void invalidateAgendaQueries(scope, { applySlots: true })
      }
      rejectRun(error)
    } finally {
      if (flightKey && inflightBySlot.get(flightKey) === run) {
        inflightBySlot.delete(flightKey)
      }
    }
  })()

  return run
}

/** Drops in-memory agenda snapshots so a later page cannot replay them. */
export function clearAgendaQueryClient(): void {
  sessionGeneration += 1
  revision += 1
  listeners.clear()
  ownSlotKeys.clear()
  recentBySubdomain.clear()
  inflightBySlot.clear()
}

export function resetAgendaQueryClientForTests(): void {
  clearAgendaQueryClient()
}
