import { getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"

export const DAILY_BOOKING_LIMIT_REACHED = "DAILY_BOOKING_LIMIT_REACHED"

export const RESERVATION_QUEUE_ERROR_CODES = [
  "QUEUE_REQUIRED",
  "QUEUE_WAITING",
  "QUEUE_TURN_EXPIRED",
  "QUEUE_TURN_ALREADY_USED",
  "QUEUE_WAITING_ROOM_CLOSED",
] as const

export type ReservationQueueErrorCode =
  (typeof RESERVATION_QUEUE_ERROR_CODES)[number]

export function isReservationQueueErrorCode(
  value: string,
): value is ReservationQueueErrorCode {
  return (RESERVATION_QUEUE_ERROR_CODES as readonly string[]).includes(value)
}

/** 409 that names this interval as already reserved. */
const INTERVAL_RESERVED_PATTERNS = [
  /não está disponível para o intervalo solicitado/i,
  /already reserved for (this|the requested) interval/i,
]

/**
 * 409 that blocks the slot without saying this interval is already reserved.
 * These still surface as errors, but the card stays "unavailable".
 */
const SLOT_UNAVAILABLE_PATTERNS = [
  /not available for booking/i,
  /insufficient quantity/i,
]

export class PortalBookingError extends Error {
  readonly status: number | null
  readonly code: string | null

  constructor(message: string, status: number | null, code: string | null) {
    super(message)
    this.name = "PortalBookingError"
    this.status = status
    this.code = code
  }
}

function readApiCode(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("code" in payload)) {
    return null
  }

  const code = payload.code
  if (typeof code !== "string") {
    return null
  }

  const trimmed = code.trim()
  return trimmed.length === 0 ? null : trimmed
}

export function portalBookingErrorFromUnknown(
  error: unknown,
  fallback: string,
): PortalBookingError {
  if (error instanceof PortalBookingError) {
    return error
  }

  const payload = getAxiosErrorPayload(error)
  const status = isAxiosError(error) ? (error.response?.status ?? null) : null
  return new PortalBookingError(
    parseApiError(payload, fallback),
    status,
    readApiCode(payload),
  )
}

export function isDailyBookingLimitError(
  error: unknown,
): error is PortalBookingError {
  return (
    error instanceof PortalBookingError &&
    error.code === DAILY_BOOKING_LIMIT_REACHED
  )
}

export function readDailyBookingLimit(error: unknown): number | null {
  if (!isDailyBookingLimitError(error)) {
    return null
  }

  const match = /(\d+)/.exec(error.message)
  if (!match?.[1]) {
    return null
  }

  const value = Number(match[1])
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    return null
  }

  return value
}

function matchesBookingConflict(
  error: unknown,
  patterns: readonly RegExp[],
): boolean {
  if (!(error instanceof PortalBookingError) || error.status !== 409) {
    return false
  }

  if (error.code === DAILY_BOOKING_LIMIT_REACHED) {
    return false
  }

  if (isReservationQueueErrorCode(error.message)) {
    return false
  }

  return patterns.some((pattern) => pattern.test(error.message))
}

/** True only when the 409 says this interval is already reserved. */
export function isSlotTakenConflict(error: unknown): boolean {
  return matchesBookingConflict(error, INTERVAL_RESERVED_PATTERNS)
}

/**
 * True for "Slot is not available for booking." and "Insufficient quantity".
 * Callers toast these and must not mark the card as reserved.
 */
export function isSlotUnavailableConflict(error: unknown): boolean {
  return matchesBookingConflict(error, SLOT_UNAVAILABLE_PATTERNS)
}
