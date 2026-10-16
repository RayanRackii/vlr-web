import { clampBrazilDateToToday } from "@/lib/brazilTimeZone"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

export function readAgendaDateParam(
  value: string | null | undefined,
  today: string,
): string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return today
  }

  return clampBrazilDateToToday(value)
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
