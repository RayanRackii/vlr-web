import { formatBrazilDateTimeRange } from "@/lib/brazilTimeZone"

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Intl inserts NBSP; a normal space matches the same reading and text queries. */
function normalizeIntlSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ")
}

/**
 * Money for any tenant currency. `locale` is the active UI language
 * (`pt-BR`, `en`, `es`), not a resource type.
 */
export function formatLocaleCurrency(
  amount: number,
  currency: string,
  locale: string,
): string {
  const normalizedCurrency = currency.trim().toUpperCase()
  try {
    return normalizeIntlSpaces(
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
      }).format(amount),
    )
  } catch {
    return `${amount.toFixed(2)} ${normalizedCurrency}`
  }
}

/** Civil `YYYY-MM-DD` in the active locale. Does not shift the calendar day. */
export function formatLocaleCivilDate(value: string, locale: string): string {
  const match = CIVIL_DATE.exec(value)
  if (!match) {
    return value
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return normalizeIntlSpaces(
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(Date.UTC(year, month - 1, day)),
  )
}

/** Instant shown as a short date and time in the active locale. */
export function formatLocaleDateTime(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return normalizeIntlSpaces(
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date),
  )
}

/**
 * Reservation start/end on the Rolvix business clock (`America/Sao_Paulo`).
 * Generic for every resource type.
 */
export function formatLocaleDateTimeRange(
  startIso: string,
  endIso: string,
  locale: string,
): string {
  return normalizeIntlSpaces(
    formatBrazilDateTimeRange(startIso, endIso, locale),
  )
}
