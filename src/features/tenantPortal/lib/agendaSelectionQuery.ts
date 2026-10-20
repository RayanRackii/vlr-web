import { clampBrazilDateToToday } from "@/lib/brazilTimeZone"

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/** `YYYY-MM-DD` that exists on the civil calendar. `2026-11-31` does not. */
export function isRealCivilDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  )
}

export function readAgendaDateParam(
  value: string | null | undefined,
  today: string,
): string {
  if (typeof value !== "string" || !isRealCivilDate(value)) {
    return today
  }

  return clampBrazilDateToToday(value)
}

export type AgendaDateAttempt =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "before" }
  | { status: "after" }
  | { status: "ok"; date: string }

/** A typed or picked day. Empty and impossible values are not a new choice. */
export function classifyAgendaDateAttempt(
  value: string,
  today: string,
  maxDate: string | null,
): AgendaDateAttempt {
  if (value.trim().length === 0) {
    return { status: "empty" }
  }
  if (!isRealCivilDate(value)) {
    return { status: "invalid" }
  }
  if (value < today) {
    return { status: "before" }
  }
  if (maxDate !== null && value > maxDate) {
    return { status: "after" }
  }
  return { status: "ok", date: value }
}

/**
 * A day typed past the horizon becomes the last bookable day.
 * The calendar still reports `after` and leaves the current day in place.
 */
export function clampTypedDateToHorizon(
  value: string,
  today: string,
  maxDate: string | null,
): AgendaDateAttempt | { status: "clamp"; date: string } {
  const attempt = classifyAgendaDateAttempt(value, today, maxDate)
  if (
    attempt.status === "after" &&
    maxDate !== null &&
    isRealCivilDate(maxDate)
  ) {
    return { status: "clamp", date: maxDate }
  }
  return attempt
}

/** `HH:mm` from `time=13:00` or `time=13:00:00`. Anything else is no choice. */
export function readAgendaTimeParam(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null
  }

  const clock = value.trim().slice(0, 5)
  if (!CLOCK.test(clock)) {
    return null
  }

  return clock
}

/**
 * Today omits `date`. A chosen time is always written so a reload does not
 * fall back to the first slot. Other params, including `reservation`, stay.
 */
export function agendaSelectionSearchParams(
  current: URLSearchParams,
  date: string,
  time: string,
  today: string,
): URLSearchParams {
  const next = new URLSearchParams(current)
  if (date === today) {
    next.delete("date")
  } else {
    next.set("date", date)
  }

  const clock = readAgendaTimeParam(time)
  if (clock === null) {
    next.delete("time")
  } else {
    next.set("time", clock)
  }

  return next
}
