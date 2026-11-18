import type { TFunction } from "i18next"

export type LateDuration = { unit: "days" | "hours" | "minutes"; count: number }

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 24 * 60

/** Largest sensible unit for a delay: whole days from 24 h, whole hours from 1 h, else minutes (at least 1). */
export function lateDuration(totalMinutes: number): LateDuration {
  const minutes = Number.isFinite(totalMinutes) ? Math.max(0, Math.floor(totalMinutes)) : 0
  if (minutes >= MINUTES_PER_DAY) return { unit: "days", count: Math.floor(minutes / MINUTES_PER_DAY) }
  if (minutes >= MINUTES_PER_HOUR) return { unit: "hours", count: Math.floor(minutes / MINUTES_PER_HOUR) }
  return { unit: "minutes", count: Math.max(1, minutes) }
}

/** Localized "2 dias" / "3 h" / "40 min" (no "late" wording; callers add it). */
export function formatLateDuration(t: TFunction, totalMinutes: number): string {
  const { unit, count } = lateDuration(totalMinutes)
  return t(`lateDuration.${unit}`, { count })
}
