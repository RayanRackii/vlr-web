export const LAYOUT_CANVAS_COLUMNS = 3
export const DEFAULT_ITEM_WIDTH = 28
export const DEFAULT_ITEM_HEIGHT = 26
export const DEFAULT_GAP_X = 4
export const DEFAULT_GAP_Y = 6
export const DEFAULT_ORIGIN = 4

export const EMPTY_SLOT_ID = "00000000-0000-0000-0000-000000000000"

export type LayoutPlacement = {
  rentalAssetId: string
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  zIndex: number
}

export type LayoutLike = {
  isActive: boolean
  items: readonly { rentalAssetId: string }[]
}

export type TimeWindow = {
  startTime: string
  endTime: string
}

export function clampPercent(value: number, size = 0): number {
  const rounded = Math.round(value * 10) / 10
  return Math.min(100 - size, Math.max(0, rounded))
}

export function autoPlaceItems(
  rentalAssetIds: readonly string[],
): LayoutPlacement[] {
  return rentalAssetIds.map((rentalAssetId, index) => {
    const col = index % LAYOUT_CANVAS_COLUMNS
    const row = Math.floor(index / LAYOUT_CANVAS_COLUMNS)
    const widthPercent = DEFAULT_ITEM_WIDTH
    const heightPercent = DEFAULT_ITEM_HEIGHT
    return {
      rentalAssetId,
      xPercent: clampPercent(
        DEFAULT_ORIGIN + col * (widthPercent + DEFAULT_GAP_X),
        widthPercent,
      ),
      yPercent: clampPercent(
        DEFAULT_ORIGIN + row * (heightPercent + DEFAULT_GAP_Y),
        heightPercent,
      ),
      widthPercent,
      heightPercent,
      zIndex: index,
    }
  })
}

export function pickCustomerLayout<T extends LayoutLike>(
  layouts: readonly T[],
  visibleRentalAssetIds: ReadonlySet<string>,
): T | null {
  let best: T | null = null
  let bestScore = 0

  for (const layout of layouts) {
    if (!layout.isActive || layout.items.length === 0) {
      continue
    }

    const score = layout.items.filter((item) =>
      visibleRentalAssetIds.has(item.rentalAssetId),
    ).length

    if (score > bestScore) {
      best = layout
      bestScore = score
    }
  }

  return bestScore > 0 ? best : null
}

export function normalizeClock(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value
}

export function listDistinctStartTimes(
  slots: readonly { startTime: string; endTime: string }[],
): TimeWindow[] {
  const byStart = new Map<string, string>()

  for (const slot of slots) {
    const startTime = normalizeClock(slot.startTime)
    const endTime = normalizeClock(slot.endTime)
    const existing = byStart.get(startTime)
    if (!existing || endTime < existing) {
      byStart.set(startTime, endTime)
    }
  }

  return [...byStart.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([startTime, endTime]) => ({ startTime, endTime }))
}

export function findSlotAtStart<
  T extends { rentalAssetId: string; startTime: string },
>(
  slots: readonly T[],
  rentalAssetId: string,
  startTime: string,
): T | undefined {
  const start = normalizeClock(startTime)
  return slots.find(
    (slot) =>
      slot.rentalAssetId === rentalAssetId &&
      normalizeClock(slot.startTime) === start,
  )
}

export function isCustomerBookableSlot(slot: {
  isBookableByCustomer: boolean
  status: string
}): boolean {
  return (
    slot.isBookableByCustomer && slot.status.toLowerCase() === "available"
  )
}

export function canBookViaSlotId(slot: {
  id: string
  isDerived: boolean
}): boolean {
  return !slot.isDerived && slot.id !== EMPTY_SLOT_ID
}
