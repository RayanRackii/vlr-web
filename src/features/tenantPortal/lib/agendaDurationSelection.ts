import { normalizeClock } from "@/features/rentals/components/layout/layoutCanvasModel"

export type TimeWindow = { startTime: string; endTime: string }

type DurationSlot = { startTime: string; endTime: string }

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
    byStart.set(startTime, endTime === "23:59" ? "00:00" : endTime)
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
