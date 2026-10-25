import {
  DAY_NAMES,
  formatScheduleTime,
  type AdminDaySlot,
  type AdminRentalAsset,
  type DayOfWeekName,
  type OccupancyKind,
  type ScheduleTemplate,
  EMPTY_SLOT_ID,
} from "@/features/rentals/services/scheduleService"

export type ScheduleSurface =
  | "page-skeleton"
  | "no-assets"
  | "no-selection"
  | "grid-skeleton"
  | "grid"

export function resolveScheduleSurface(input: {
  loading: boolean
  showSkeleton: boolean
  assetCount: number
  selectedCount: number
}): ScheduleSurface {
  if (input.assetCount === 0) {
    return input.loading || input.showSkeleton ? "page-skeleton" : "no-assets"
  }
  if (input.selectedCount === 0) {
    return "no-selection"
  }
  if (input.showSkeleton) {
    return "grid-skeleton"
  }
  return "grid"
}

export type ScheduleGridOccupancy = {
  id: string
  rentalAssetId: string
  startTime: string
  endTime: string
  occupancyKindLabel: string
  /** Stable kind key (e.g. "open"); label stays tenant-editable. */
  occupancyKindKey?: string | null
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

export function occupancyIdFromSlot(slot: {
  id: string
  isDerived: boolean
  rentalAssetId: string
  startTime: string
}): string {
  if (slot.isDerived || slot.id === EMPTY_SLOT_ID) {
    return `derived:${slot.rentalAssetId}:${formatScheduleTime(slot.startTime)}`
  }
  return slot.id
}

export function occupancyFromDaySlot(slot: AdminDaySlot): ScheduleGridOccupancy {
  return {
    id: occupancyIdFromSlot(slot),
    rentalAssetId: slot.rentalAssetId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    occupancyKindLabel: slot.occupancyKindLabel,
    occupancyKindKey: slot.occupancyKindKey,
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
        occupancyKindKey: kind?.key ?? null,
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
      occupancyKindKey: openKind.key,
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

/** Stock occupancy kinds seeded in English; a tenant-renamed kind keeps its configured name. */
const SEED_OCCUPANCY_KIND_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  lesson: "Lesson",
}

export function localizedOccupancyKindLabel(
  occupancyKindKey: string | null | undefined,
  occupancyKindLabel: string,
  t: (key: string) => string,
): string {
  const key = occupancyKindKey ?? ""
  if (SEED_OCCUPANCY_KIND_LABELS[key] === occupancyKindLabel) {
    return t(`rentals.schedule.occupancyKinds.${key}`)
  }
  return occupancyKindLabel
}

/**
 * OpenHours availability is computed on the fly per allowed duration (1h/2h/4h),
 * so the same asset/day can return several windows that overlap in time. Collapse
 * them to the base (smallest) duration grid, keeping longer windows only where an
 * actual booking spans them.
 */
export function dedupeOpenHoursOccupancies(
  occupancies: readonly ScheduleGridOccupancy[],
  baseStepMinutes: number,
): ScheduleGridOccupancy[] {
  const booked = occupancies.filter((item) => item.status === "booked")
  const notBooked = occupancies.filter((item) => item.status !== "booked")

  const keptBooked: ScheduleGridOccupancy[] = []
  const bookedByDurationDesc = [...booked].sort((a, b) => {
    const durationA = timeToMinutes(a.endTime) - timeToMinutes(a.startTime)
    const durationB = timeToMinutes(b.endTime) - timeToMinutes(b.startTime)
    if (durationA !== durationB) return durationB - durationA
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  })
  for (const item of bookedByDurationDesc) {
    const start = timeToMinutes(item.startTime)
    const end = timeToMinutes(item.endTime)
    const alreadyCovered = keptBooked.some((kept) => {
      const keptStart = timeToMinutes(kept.startTime)
      const keptEnd = timeToMinutes(kept.endTime)
      return keptStart <= start && keptEnd >= end
    })
    if (!alreadyCovered) {
      keptBooked.push(item)
    }
  }

  const baseNotBooked = notBooked.filter((item) => {
    const duration = timeToMinutes(item.endTime) - timeToMinutes(item.startTime)
    if (duration !== baseStepMinutes) return false
    const start = timeToMinutes(item.startTime)
    const end = timeToMinutes(item.endTime)
    return !keptBooked.some(
      (kept) =>
        timeToMinutes(kept.startTime) < end && timeToMinutes(kept.endTime) > start,
    )
  })

  return [...baseNotBooked, ...keptBooked]
}
