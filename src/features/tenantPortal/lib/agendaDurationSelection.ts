import { displayEndClock } from "@/lib/tenantTimeZone"
import { normalizeClock } from "@/features/rentals/components/layout/layoutCanvasModel"

export type TimeWindow = { startTime: string; endTime: string }

type DurationSlot = { startTime: string; endTime: string }

type MultiSlotAsset = {
  id: string
  schedulePolicy?: string
  allowedDurationMinutes?: string | null
}

type MultiSlotWindow = DurationSlot & {
  id: string
  rentalAssetId: string
  assetName: string
  date: string
  occupancyKindId: string
  occupancyKindKey: string
  occupancyKindLabel: string
  isBookableByCustomer: boolean
  status: string
  reservationId?: string | null
  isDerived: boolean
}

const EMPTY_SLOT_ID = "00000000-0000-0000-0000-000000000000"

function allowedDurations(value: string | null | undefined): number[] {
  return [...new Set(
    (value ?? "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((minutes) => Number.isInteger(minutes) && minutes > 0),
  )].sort((left, right) => left - right)
}

function normalizedRangeKey(slot: Pick<DurationSlot & { rentalAssetId: string }, "rentalAssetId" | "startTime" | "endTime">): string {
  return `${slot.rentalAssetId}:${normalizeClock(slot.startTime)}:${normalizeClock(slot.endTime)}`
}

/**
 * Builds customer-bookable, contiguous SlotGrid ranges permitted by a resource.
 * The returned ranges are synthetic so reservations use their explicit times.
 */
export function buildMultiSlotWindows<T extends MultiSlotWindow>(
  slots: readonly T[],
  assets: readonly MultiSlotAsset[],
): T[] {
  const realRanges = new Set(slots.map(normalizedRangeKey))
  const windows: T[] = []

  for (const asset of assets) {
    if (asset.schedulePolicy?.toLowerCase() !== "slotgrid") {
      continue
    }
    const durations = allowedDurations(asset.allowedDurationMinutes)
    if (durations.length === 0) {
      continue
    }

    const maxDuration = durations[durations.length - 1] ?? 0
    const assetSlots = slots
      .filter((slot) =>
        slot.rentalAssetId === asset.id &&
        slot.isBookableByCustomer &&
        slot.status.toLowerCase() === "available",
      )
      .sort((left, right) => normalizeClock(left.startTime).localeCompare(normalizeClock(right.startTime)))

    for (let index = 0; index < assetSlots.length; index += 1) {
      const first = assetSlots[index]
      if (!first) continue
      const firstDuration = slotDurationMinutes(first)
      let totalDuration = 0
      let previous: T | undefined

      for (let candidateIndex = index; candidateIndex < assetSlots.length; candidateIndex += 1) {
        const candidate = assetSlots[candidateIndex]
        if (!candidate) continue
        if (previous && normalizeClock(candidate.startTime) !== normalizeClock(previous.endTime)) {
          break
        }
        totalDuration += slotDurationMinutes(candidate)
        if (totalDuration > maxDuration) {
          break
        }
        if (totalDuration > firstDuration && durations.includes(totalDuration)) {
          const window = {
            ...first,
            id: EMPTY_SLOT_ID,
            startTime: first.startTime,
            endTime: candidate.endTime,
            isDerived: true,
            status: "Available",
            reservationId: null,
          } as T
          if (!realRanges.has(normalizedRangeKey(window))) {
            windows.push(window)
          }
        }
        previous = candidate
      }
    }
  }

  return windows
}

/** Minutes between two `HH:mm` or `HH:mm:ss` clocks on the same civil day. */
export function slotDurationMinutes(slot: DurationSlot): number {
  const [startHour, startMinute] = normalizeClock(slot.startTime)
    .split(":")
    .map(Number)
  const [endHour, endMinute] = normalizeClock(slot.endTime)
    .split(":")
    .map(Number)
  const startMinutes = startHour * 60 + startMinute
  let endMinutes = endHour * 60 + endMinute
  // A slot closing the civil day is stored as 23:59(:59) or 00:00; it ends at 24:00.
  if (endMinutes === 23 * 60 + 59 || (endMinutes === 0 && startMinutes > 0)) {
    endMinutes = 24 * 60
  }
  return endMinutes - startMinutes
}

/** Distinct booking durations (minutes) across every slot of the day, ascending. */
export function listDistinctDurations(
  slots: readonly DurationSlot[],
): number[] {
  const durations = new Set<number>()
  for (const slot of slots) {
    const minutes = slotDurationMinutes(slot)
    if (minutes > 0) {
      durations.add(minutes)
    }
  }
  return [...durations].sort((left, right) => left - right)
}

/** Distinct start times for slots matching one specific duration. */
export function listStartTimesForDuration(
  slots: readonly DurationSlot[],
  durationMinutes: number,
): TimeWindow[] {
  const byStart = new Map<string, string>()
  for (const slot of slots) {
    if (slotDurationMinutes(slot) !== durationMinutes) {
      continue
    }
    const startTime = normalizeClock(slot.startTime)
    const endTime = normalizeClock(slot.endTime)
    byStart.set(startTime, displayEndClock(endTime))
  }
  return [...byStart.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([startTime, endTime]) => ({ startTime, endTime }))
}

/** The slot for one resource, start time and duration. */
export function findSlotAtStartAndDuration<
  T extends { rentalAssetId: string; startTime: string; endTime: string },
>(
  slots: readonly T[],
  rentalAssetId: string,
  startTime: string,
  durationMinutes: number,
): T | undefined {
  const start = normalizeClock(startTime)
  return slots.find(
    (slot) =>
      slot.rentalAssetId === rentalAssetId &&
      normalizeClock(slot.startTime) === start &&
      slotDurationMinutes(slot) === durationMinutes,
  )
}

/** "1h", "1h30", "30min" — locale-neutral, no translation needed. */
export function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `${rest}min`
  }
  if (rest === 0) {
    return `${hours}h`
  }
  return `${hours}h${rest}`
}

/** Keeps the current duration when it is still offered; otherwise the shortest. */
export function resolveEffectiveDuration(
  availableDurations: readonly number[],
  selectedDuration: number | null,
): number | null {
  if (
    selectedDuration !== null &&
    availableDurations.includes(selectedDuration)
  ) {
    return selectedDuration
  }
  return availableDurations[0] ?? null
}
