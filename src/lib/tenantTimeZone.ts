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

  return `${formatTenantDate(start, timeZoneId, locale)} ${formatTenantTime(start, timeZoneId, locale)} – ${formatTenantTime(end, timeZoneId, locale)}`
}
