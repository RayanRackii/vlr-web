import {
  DAY_NAMES,
  formatScheduleTime,
  type AdminDaySlot,
  type AdminRentalAsset,
  type DayOfWeekName,
  type OccupancyKind,
  type ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"

export type ScheduleGridOccupancy = {
  id: string
  rentalAssetId: string
  startTime: string
  endTime: string
  occupancyKindLabel: string
  occupancyKindColorHex?: string | null
  label?: string | null
  status: "available" | "booked" | "unavailable"
  badge?: "dailyOverride" | "inactive" | null
}

export function timeToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":")
  return Number(hours) * 60 + Number(minutes)
}

export function formatMinutesAsTime(value: number): string {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function gcd(a: number, b: number): number {
  let left = Math.abs(a)
  let right = Math.abs(b)
  while (right) {
    ;[left, right] = [right, left % right]
  }
  return left
}

export function durationValues(asset: AdminRentalAsset): number[] {
  return (asset.allowedDurationMinutes ?? "")
    .split(",")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
}

export function todayWeekdayName(): DayOfWeekName {
  return DAY_NAMES[new Date().getDay()] ?? "Monday"
}

export function shiftWeekday(
  current: DayOfWeekName,
  delta: number,
): DayOfWeekName {
  const index = DAY_NAMES.indexOf(current)
  const next = (index + delta + DAY_NAMES.length) % DAY_NAMES.length
  return DAY_NAMES[next] ?? "Monday"
}

export function occupancyFromDaySlot(slot: AdminDaySlot): ScheduleGridOccupancy {
  return {
    id: slot.id,
    rentalAssetId: slot.rentalAssetId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    occupancyKindLabel: slot.occupancyKindLabel,
    occupancyKindColorHex: slot.occupancyKindColorHex,
    label: slot.label,
    status: slotStatus(slot),
    badge: slot.source === "DailyOverride" ? "dailyOverride" : null,
  }
}

export function buildWeeklyGridOccupancies(
  assets: readonly AdminRentalAsset[],
  templates: readonly ScheduleTemplate[],
  kinds: readonly OccupancyKind[],
  weekday: string,
): ScheduleGridOccupancy[] {
  const openKind =
    kinds.find((kind) => kind.key === "open" && kind.isActive) ??
    kinds.find((kind) => kind.isActive && kind.isBookableByCustomer) ??
    kinds.find((kind) => kind.isActive)

  const occupancies: ScheduleGridOccupancy[] = []

  for (const asset of assets) {
    const policy = asset.schedulePolicy ?? "SlotGrid"
    if (policy === "OpenHours") {
      occupancies.push(
        ...openHoursOccupancies(asset, openKind),
      )
      continue
    }

    for (const row of templates) {
      if (row.rentalAssetId !== asset.id || row.dayOfWeek !== weekday) {
        continue
      }
      const kind = kinds.find((item) => item.id === row.occupancyKindId)
      occupancies.push({
        id: row.id,
        rentalAssetId: row.rentalAssetId,
        startTime: row.startTime,
        endTime: row.endTime,
        occupancyKindLabel: row.occupancyKindLabel,
        occupancyKindColorHex: kind?.colorHex,
        label: row.label,
        status:
          row.isActive && (kind?.isBookableByCustomer ?? true)
            ? "available"
            : "unavailable",
        badge: row.isActive ? null : "inactive",
      })
    }
  }

  return occupancies
}

function openHoursOccupancies(
  asset: AdminRentalAsset,
  openKind: OccupancyKind | undefined,
): ScheduleGridOccupancy[] {
  if (!openKind || !asset.openTime || !asset.closeTime) {
    return []
  }

  const open = timeToMinutes(formatScheduleTime(asset.openTime))
  const close = timeToMinutes(formatScheduleTime(asset.closeTime))
  const step = durationValues(asset)[0] ?? 60
  if (close <= open || step <= 0) {
    return []
  }

  const occupancies: ScheduleGridOccupancy[] = []
  for (let cursor = open; cursor + step <= close; cursor += step) {
    occupancies.push({
      id: `openhours:${asset.id}:${formatMinutesAsTime(cursor)}`,
      rentalAssetId: asset.id,
      startTime: formatMinutesAsTime(cursor),
      endTime: formatMinutesAsTime(cursor + step),
      occupancyKindLabel: openKind.label,
      occupancyKindColorHex: openKind.colorHex,
      label: null,
      status: openKind.isBookableByCustomer ? "available" : "unavailable",
      badge: null,
    })
  }
  return occupancies
}

function slotStatus(slot: AdminDaySlot): ScheduleGridOccupancy["status"] {
  if (slot.status === "Booked" || slot.reservationId) {
    return "booked"
  }
  if (slot.status === "Cancelled" || !slot.isBookableByCustomer) {
    return "unavailable"
  }
  return "available"
}

export function isOpenHoursOccupancyId(id: string): boolean {
  return id.startsWith("openhours:")
}
