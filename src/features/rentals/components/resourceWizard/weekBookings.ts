import { tenantCivilDateTime } from "@/lib/tenantTimeZone"

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function addCivilDays(iso: string, days: number): string {
  const match = ISO_DATE.exec(iso)
  if (!match) {
    throw new Error("invalid civil date")
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const next = new Date(utc + days * 86_400_000)
  const year = next.getUTCFullYear()
  const month = String(next.getUTCMonth() + 1).padStart(2, "0")
  const day = String(next.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Monday-start week of a civil yyyy-mm-dd, independent of the browser zone. */
export function mondayOfWeek(iso: string): string {
  const match = ISO_DATE.exec(iso)
  if (!match) {
    throw new Error("invalid civil date")
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const sinceMonday = (new Date(utc).getUTCDay() + 6) % 7
  return addCivilDays(iso, -sinceMonday)
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addCivilDays(monday, index))
}

export function formatCivilDay(iso: string, locale: string): string {
  const match = ISO_DATE.exec(iso)
  if (!match) {
    return iso
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    .toLocaleDateString(locale, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    })
}

type ResourceMatch = {
  items: readonly { rentalAssetId: string; assetId: string }[]
}

export function reservationMatchesResource(
  reservation: ResourceMatch,
  rentalAssetId: string,
  assetId: string,
): boolean {
  return reservation.items.some(
    (item) => item.rentalAssetId === rentalAssetId || item.assetId === assetId,
  )
}

export function groupByCivilDate<T extends { startDateTime: string }>(
  rows: readonly T[],
  timeZone: string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const date = tenantCivilDateTime(new Date(row.startDateTime), timeZone).date
    const current = grouped.get(date) ?? []
    current.push(row)
    grouped.set(date, current)
  }
  for (const dayRows of grouped.values()) {
    dayRows.sort((left, right) => left.startDateTime.localeCompare(right.startDateTime))
  }
  return grouped
}
