import { applyDailyOccurrence, fetchAdminScheduleDay, upsertSlot, type AdminDaySlot, type OccupancyKind } from "@/features/rentals/services/scheduleService"

export type BlockPeriodInput = {
  rentalAssetId: string
  date: string
  /** "HH:mm" */
  start: string
  /** "HH:mm" */
  end: string
  kindId: string
  note: string
}

export type BlockPeriodResult = {
  /** Slots (or the one new slot) that now carry the block. */
  blocked: number
  /** Booked slots in the range that were left untouched, as "HH:mm–HH:mm". */
  skipped: string[]
  /** Slots whose update failed, with the API message. */
  failed: { range: string; message: string }[]
}

const minutes = (time: string) => {
  const [hour = 0, minute = 0] = time.split(":").map(Number)
  return hour * 60 + minute
}
const clock = (time: string) => time.slice(0, 5)
const rangeLabel = (slot: Pick<AdminDaySlot, "startTime" | "endTime">) => `${clock(slot.startTime)}–${clock(slot.endTime)}`

/** Kinds staff can block with: they take capacity away and are not sold to customers. */
export const blockingKinds = (kinds: readonly OccupancyKind[]) => kinds.filter((kind) => kind.isActive && kind.blocksCapacity && !kind.isBookableByCustomer)

const isBooked = (slot: AdminDaySlot) => slot.status === "Booked" || Boolean(slot.reservationId)

/**
 * Blocks a time range of one resource on one day. The slots API has no "block this range" call:
 * upsert matches only by exact start and does no overlap check. So each non-booked slot that overlaps
 * the range is updated in place (OnlyThisDay, keeping its own start and end); when the resource has
 * no slot in the range (open hours), one slot is created for the exact range. Booked slots are
 * never touched and are reported back.
 */
export async function blockPeriod(input: BlockPeriodInput): Promise<BlockPeriodResult> {
  const from = minutes(input.start)
  const to = minutes(input.end)
  const note = input.note.trim() || null
  const day = await fetchAdminScheduleDay(input.date, [input.rentalAssetId])
  const overlapping = day.slots
    .filter((slot) => slot.rentalAssetId === input.rentalAssetId && minutes(slot.startTime) < to && minutes(slot.endTime) > from)
    .sort((a, b) => minutes(a.startTime) - minutes(b.startTime))
  const result: BlockPeriodResult = { blocked: 0, skipped: [], failed: [] }

  if (overlapping.length === 0) {
    await upsertSlot({ rentalAssetId: input.rentalAssetId, date: input.date, startTime: input.start, endTime: input.end, occupancyKindId: input.kindId, label: note })
    result.blocked = 1
    return result
  }

  for (const slot of overlapping) {
    if (isBooked(slot)) {
      result.skipped.push(rangeLabel(slot))
      continue
    }
    try {
      await applyDailyOccurrence({
        slotId: slot.id,
        rentalAssetId: input.rentalAssetId,
        date: input.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        action: "Update",
        scope: "OnlyThisDay",
        occupancyKindId: input.kindId,
        label: note,
      })
      result.blocked += 1
    } catch (error) {
      result.failed.push({ range: rangeLabel(slot), message: error instanceof Error ? error.message : "" })
    }
  }
  return result
}
