import { z } from "zod"

export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Form errors use supplied translations, never the wire schema's diagnostic text. */
export function civilDateFormSchema(required: string, invalid = required) {
  return z.string({ error: required }).trim().min(1, required)
    .refine((value) => value === "" || isCivilDate(value), invalid)
}

export function parseLocaleCivilDate(value: string, locale: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const monthFirst = locale.toLowerCase().startsWith("en")
  const day = match[monthFirst ? 2 : 1].padStart(2, "0")
  const month = match[monthFirst ? 1 : 2].padStart(2, "0")
  const iso = `${match[3]}-${month}-${day}`
  return isCivilDate(iso) ? iso : null
}
