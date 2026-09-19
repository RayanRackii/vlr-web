const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatCivilDateOnly(value: string, locale: string): string {
  const match = CIVIL_DATE.exec(value)
  if (!match) {
    return value
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day))
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
