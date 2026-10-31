import {
  DEFAULT_TENANT_TIME_ZONE,
  formatTenantDateTimeRange,
  resolveTenantTimeZone,
} from "@/lib/tenantTimeZone"

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Intl inserts NBSP; a normal space matches the same reading and text queries. */
function normalizeIntlSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ")
}

export type FormatLocaleCurrencyOptions = {
  maximumFractionDigits?: number
  minimumFractionDigits?: number
}

/**
 * Symbol for `currency` when the active locale would print the ISO code
 * (Spanish prints `BRL` for the Brazilian real).
 */
function currencySymbol(currency: string): string | null {
  try {
    const part = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((item) => item.type === "currency")
    const symbol = part?.value ?? ""
    if (symbol.length === 0 || symbol.toUpperCase() === currency) {
      return null
    }
    return symbol
  } catch {
    return null
  }
}

function joinCurrencyParts(parts: readonly Intl.NumberFormatPart[]): string {
  let result = ""
  let previousType: Intl.NumberFormatPart["type"] | null = null
  for (const part of parts) {
    const symbolTouchesAmount =
      (previousType === "currency" && part.type === "integer") ||
      (part.type === "currency" &&
        (previousType === "integer" || previousType === "fraction"))
    if (symbolTouchesAmount) {
      result += " "
    }
    result += part.value
    previousType = part.type
  }
  return normalizeIntlSpaces(result)
}

/**
 * Money for any tenant currency. `locale` is the active UI language
 * (`pt-BR`, `en`, `es`), not a resource type. The symbol is the currency
 * symbol (`R$`, `€`), including when the locale would otherwise print the
 * ISO code. Grouping follows that locale, including amounts under 10_000
 * (Spanish uses pt-BR for BRL: `R$ 1.500,00`).
 */
export function formatLocaleCurrency(
  amount: number,
  currency: string,
  locale: string,
  options?: FormatLocaleCurrencyOptions,
): string {
  const normalizedCurrency = currency.trim().toUpperCase()
  try {
    const symbol = currencySymbol(normalizedCurrency)
    const moneyLocale = normalizedCurrency === "BRL" && locale.toLowerCase().startsWith("es")
      ? "pt-BR"
      : locale
    const parts = new Intl.NumberFormat(moneyLocale, {
      style: "currency",
      currency: normalizedCurrency,
      currencyDisplay: "symbol",
      useGrouping: "always",
      maximumFractionDigits: options?.maximumFractionDigits,
      minimumFractionDigits: options?.minimumFractionDigits,
    }).formatToParts(amount)
    const withSymbol = parts.map((part) => {
      if (
        part.type === "currency" &&
        part.value.toUpperCase() === normalizedCurrency &&
        symbol
      ) {
        return { ...part, value: symbol }
      }
      return part
    })
    return joinCurrencyParts(withSymbol)
  } catch {
    return `${amount.toFixed(2)} ${normalizedCurrency}`
  }
}

/** Civil `YYYY-MM-DD` as day and month only. Does not shift the calendar day. */
export function formatLocaleCivilDayMonth(value: string, locale: string): string {
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
      timeZone: "UTC",
    }).format(Date.UTC(year, month - 1, day)),
  )
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
  const date = new Date(0)
  // Date.UTC treats years 0–99 as 1900–1999.
  date.setUTCFullYear(year, month - 1, day)

  return normalizeIntlSpaces(
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).formatToParts(date)
      .map((part) => part.type === "year" ? part.value.padStart(4, "0") : part.value)
      .join(""),
  )
}

/** Instant shown as a short date and time in the active locale. */
export function formatLocaleDateTime(value: string, locale: string, timeZoneId?: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return normalizeIntlSpaces(
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
      ...(timeZoneId ? { timeZone: resolveTenantTimeZone(timeZoneId) } : {}),
    }).format(date),
  )
}

/**
 * Reservation start/end on the tenant business clock.
 * Generic for every resource type.
 */
export function formatLocaleDateTimeRange(
  startIso: string,
  endIso: string,
  locale: string,
  timeZoneId: string = DEFAULT_TENANT_TIME_ZONE,
): string {
  return normalizeIntlSpaces(
    formatTenantDateTimeRange(startIso, endIso, timeZoneId, locale),
  )
}
