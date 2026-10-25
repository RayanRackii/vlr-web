/** Default business clock when the tenant contract does not provide a zone. */
export const DEFAULT_TENANT_TIME_ZONE = "America/Sao_Paulo"

export function resolveTenantTimeZone(
  timeZoneId: string | null | undefined,
): string {
  const candidate = timeZoneId?.trim()
  if (!candidate) {
    return DEFAULT_TENANT_TIME_ZONE
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format()
    return candidate
  } catch {
    return DEFAULT_TENANT_TIME_ZONE
  }
}

function padClockPart(value: string): string {
  return value.padStart(2, "0")
}

function tenantCivilParts(
  instant: Date,
  timeZoneId: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTenantTimeZone(timeZoneId),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  const hour = read("hour") === "24" ? "00" : padClockPart(read("hour"))

  return {
    date: `${read("year")}-${padClockPart(read("month"))}-${padClockPart(read("day"))}`,
    time: `${hour}:${padClockPart(read("minute"))}:${padClockPart(read("second"))}`,
  }
}

export function tenantTodayIsoDate(
  timeZoneId: string,
  now: Date = new Date(),
): string {
  return tenantCivilParts(now, timeZoneId).date
}

/** Civil date and `HH:mm:ss` clock of an instant in the tenant timezone. */
export function tenantCivilDateTime(
  instant: Date,
  timeZoneId: string,
): { date: string; time: string } {
  return tenantCivilParts(instant, timeZoneId)
}

function normalizeClockHms(value: string): string {
  const [hour = "0", minute = "0", second = "0"] = value.split(":")
  return `${padClockPart(hour)}:${padClockPart(minute)}:${padClockPart(second)}`
}

/** True when this civil slot start is already reached on the tenant clock. */
export function isTenantSlotStartInPast(
  dateIso: string,
  startTime: string,
  timeZoneId: string,
  now: Date = new Date(),
): boolean {
  const clock = tenantCivilParts(now, timeZoneId)
  if (dateIso < clock.date) {
    return true
  }
  if (dateIso > clock.date) {
    return false
  }
  return normalizeClockHms(startTime) <= clock.time
}

/** Keeps an incomplete value; a complete civil date before today becomes today. */
export function clampTenantDateToToday(
  value: string,
  timeZoneId: string,
  now: Date = new Date(),
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const today = tenantTodayIsoDate(timeZoneId, now)
  return value < today ? today : value
}

export function formatTenantDate(
  value: Date,
  timeZoneId: string,
  locale?: string,
): string {
  return value.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: resolveTenantTimeZone(timeZoneId),
  })
}

export function formatTenantTime(
  value: Date,
  timeZoneId: string,
  locale?: string,
): string {
  return value.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: resolveTenantTimeZone(timeZoneId),
  })
}

/** Civil `dd/MM` of an instant in the tenant timezone, without a year. */
export function formatTenantDayMonth(
  value: Date,
  timeZoneId: string,
  locale?: string,
): string {
  return value.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    timeZone: resolveTenantTimeZone(timeZoneId),
  })
}

/** A day-closing end stored as 23:59 or 23:59:59 reads as 00:00 (midnight), without a date. */
export function displayEndClock(clock: string): string {
  const hhmm = clock.length >= 5 ? clock.slice(0, 5) : clock
  return hhmm === "23:59" ? "00:00" : hhmm
}

/** End clock sent to the API: HH:mm, keeping seconds when not :00 so 23:59:59 matches the slot. */
export function bookingEndClock(endTime: string): string {
  const seconds = endTime.slice(5, 8)
  return seconds.length === 3 && seconds !== ":00" ? endTime.slice(0, 8) : endTime.slice(0, 5)
}

/** Reservation end instant for display: 23:59:59 local (legacy rows) shows as the next 00:00. */
export function displayEndInstant(end: Date, timeZoneId: string): Date {
  const clock = end.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    timeZone: resolveTenantTimeZone(timeZoneId),
  })
  return clock === "23:59:59" ? new Date(end.getTime() + 1000 - end.getMilliseconds()) : end
}

function civilDateDiffDays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number)
  const [ey, em, ed] = endDate.split("-").map(Number)
  return Math.round(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000,
  )
}

/** Civil days covered by an instant range in the tenant timezone, inclusive of both ends. */
export function tenantCivilDaySpan(
  startIso: string,
  endIso: string,
  timeZoneId: string,
): number {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1
  }
  const startDate = tenantCivilDateTime(start, timeZoneId).date
  const endDate = tenantCivilDateTime(
    displayEndInstant(end, timeZoneId),
    timeZoneId,
  ).date
  return civilDateDiffDays(startDate, endDate) + 1
}

/**
 * Formats true instants in the tenant zone. Intl maps instants across DST
 * transitions, so a spring-forward range skips nonexistent civil clocks.
 */
export function formatTenantDateTimeRange(
  startIso: string,
  endIso: string,
  timeZoneId: string,
  locale?: string,
): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return `${startIso} – ${endIso}`
  }

  return `${formatTenantDate(start, timeZoneId, locale)} ${formatTenantTime(start, timeZoneId, locale)} – ${formatTenantTime(displayEndInstant(end, timeZoneId), timeZoneId, locale)}`
}
