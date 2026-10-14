/** Rolvix business clock (T1). Not the browser/device timezone. */
export const SAO_PAULO_TZ = "America/Sao_Paulo"

const brazilCivilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function brazilTodayIsoDate(now: Date = new Date()): string {
  return brazilCivilDateFormatter.format(now)
}

function padClockPart(value: string): string {
  return value.padStart(2, "0")
}

function brazilCivilParts(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""

  const hour = read("hour") === "24" ? "00" : padClockPart(read("hour"))

  return {
    date: `${read("year")}-${padClockPart(read("month"))}-${padClockPart(read("day"))}`,
    time: `${hour}:${padClockPart(read("minute"))}:${padClockPart(read("second"))}`,
  }
}

function normalizeClockHms(value: string): string {
  const [hour = "0", minute = "0", second = "0"] = value.split(":")
  return `${padClockPart(hour)}:${padClockPart(minute)}:${padClockPart(second)}`
}

/** True when this civil slot start is already reached in America/Sao_Paulo. */
export function isBrazilSlotStartInPast(
  dateIso: string,
  startTime: string,
  now: Date = new Date(),
): boolean {
  const clock = brazilCivilParts(now)
  if (dateIso < clock.date) {
    return true
  }
  if (dateIso > clock.date) {
    return false
  }
  return normalizeClockHms(startTime) <= clock.time
}

/** Keeps an incomplete value; a complete civil date before today becomes today. */
export function clampBrazilDateToToday(
  value: string,
  now: Date = new Date(),
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const today = brazilTodayIsoDate(now)
  return value < today ? today : value
}

export function formatBrazilDate(value: Date, locale?: string): string {
  return value.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SAO_PAULO_TZ,
  })
}

export function formatBrazilTime(value: Date, locale?: string): string {
  return value.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SAO_PAULO_TZ,
  })
}

export function formatBrazilDateTimeRange(
  startIso: string,
  endIso: string,
  locale?: string,
): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} – ${endIso}`
  }

  return `${formatBrazilDate(start, locale)} ${formatBrazilTime(start, locale)} – ${formatBrazilTime(end, locale)}`
}
