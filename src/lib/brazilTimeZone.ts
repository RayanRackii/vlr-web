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
