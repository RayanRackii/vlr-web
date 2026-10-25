const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export const BOOKING_HORIZON_DAY_MIN = 0
export const BOOKING_HORIZON_DAY_MAX = 3650

/** Civil date plus a number of days, without a timezone shift. */
export function addCivilDays(isoDate: string, days: number): string {
  const match = ISO_DATE.exec(isoDate)
  if (!match) {
    return isoDate
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const nextYear = utc.getUTCFullYear()
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const nextDay = String(utc.getUTCDate()).padStart(2, "0")
  return `${nextYear}-${nextMonth}-${nextDay}`
}

/** Civil days between two ISO dates, without a timezone shift. */
export function civilDaysBetween(startIso: string, endIso: string): number {
  const startMatch = ISO_DATE.exec(startIso)
  const endMatch = ISO_DATE.exec(endIso)
  if (!startMatch || !endMatch) {
    return 0
  }

  const start = Date.UTC(
    Number(startMatch[1]),
    Number(startMatch[2]) - 1,
    Number(startMatch[3]),
  )
  const end = Date.UTC(
    Number(endMatch[1]),
    Number(endMatch[2]) - 1,
    Number(endMatch[3]),
  )
  return Math.round((end - start) / 86400000)
}

export function isHorizonDayCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= BOOKING_HORIZON_DAY_MIN &&
    value <= BOOKING_HORIZON_DAY_MAX
  )
}

/**
 * Latest civil date the picker may offer.
 * `null` or a missing count means unlimited: do not cap.
 */
export function horizonEndDate(
  todayIso: string,
  days: number | null | undefined,
): string | null {
  if (days == null || !isHorizonDayCount(days)) {
    return null
  }

  return addCivilDays(todayIso, days)
}

/**
 * Days the agenda picker may offer ahead of today.
 * `undefined`: no loaded payload exposed a horizon, so do not cap.
 * `null`: a visible resource is unlimited.
 * A number is the furthest effective horizon among the visible resources.
 */
export function resolveAgendaHorizonDays(
  assets: readonly { effectiveMaxAdvanceBookingDays?: number | null }[],
  policyDays: number | null | undefined,
): number | null | undefined {
  const assetsExposeField = assets.some(
    (asset) => asset.effectiveMaxAdvanceBookingDays !== undefined,
  )
  if (!assetsExposeField && policyDays === undefined) {
    return undefined
  }

  if (assets.length === 0 || !assetsExposeField) {
    return policyDays ?? null
  }

  let furthest = 0
  let sawNumber = false
  for (const asset of assets) {
    const days = asset.effectiveMaxAdvanceBookingDays
    if (days === undefined) {
      if (policyDays == null || !isHorizonDayCount(policyDays)) {
        return null
      }
      sawNumber = true
      furthest = Math.max(furthest, policyDays)
      continue
    }
    if (days === null || !isHorizonDayCount(days)) {
      return null
    }
    sawNumber = true
    furthest = Math.max(furthest, days)
  }

  return sawNumber ? furthest : null
}

export function clampDateToHorizon(value: string, maxDate: string | null): string {
  if (maxDate === null || !ISO_DATE.test(value) || !ISO_DATE.test(maxDate)) {
    return value
  }

  return value > maxDate ? maxDate : value
}
