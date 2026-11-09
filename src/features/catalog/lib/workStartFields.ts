export type WorkStartParts = {
  day: string
  month: string
  year: string
  hour: string
  minute: string
}

function readPart(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }
  return Number(trimmed)
}

/** Local `YYYY-MM-DDTHH:mm`. Day and month are separate so a US locale cannot swap them. */
export function composeWorkStart(parts: WorkStartParts): string | null {
  const day = readPart(parts.day)
  const month = readPart(parts.month)
  const year = readPart(parts.year)
  const hour = readPart(parts.hour)
  const minute = readPart(parts.minute)
  if (day == null || month == null || year == null || hour == null || minute == null) {
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
