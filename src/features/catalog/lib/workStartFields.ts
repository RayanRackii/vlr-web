export type WorkStartParts = {
  day: string
  month: string
  year: string
  hour: string
  minute: string
}

/** Local `YYYY-MM-DDTHH:mm`. Day and month are separate so a US locale cannot swap them. */
export function composeWorkStart(parts: WorkStartParts): string | null {
  const day = Number(parts.day)
  const month = Number(parts.month)
  const year = Number(parts.year)
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  if (![day, month, year, hour, minute].every((value) => Number.isInteger(value))) {
    return null
  }
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  const date = new Date(year, month - 1, day, hour, minute, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}
