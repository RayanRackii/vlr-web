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
