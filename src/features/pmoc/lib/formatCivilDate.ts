import { formatLocaleCivilDate } from "@/lib/localeFormat"

export function formatCivilDateOnly(value: string, locale: string): string {
  return formatLocaleCivilDate(value, locale)
}

export function formatBrazilInstantDate(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

/** "26 jun 2026": a civil date (YYYY-MM-DD) as day, short month and year, without time-zone shifts. */
export function formatCivilDateHuman(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) {
    return value
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("day")} ${pick("month").replace(/\.$/, "")} ${pick("year")}`
}

/** Same format for an instant, read in the Brazil time zone (the tenant default). */
export function formatInstantHuman(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return `${pick("day")} ${pick("month").replace(/\.$/, "")} ${pick("year")}`
}
