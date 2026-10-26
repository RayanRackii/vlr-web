/** A court-shaped canvas avoids unused vertical space for the default blocks. */
export const DEFAULT_ASPECT_RATIO = 2
export const MIN_ASPECT_RATIO = 0.7
export const MAX_ASPECT_RATIO = 2.8
export const DEFAULT_CANVAS_WIDTH_PERCENT = 100
export const MIN_CANVAS_WIDTH_PERCENT = 50
export const MAX_CANVAS_WIDTH_PERCENT = 100

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

export function clampAspectRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_ASPECT_RATIO
  }
  return Math.min(
    MAX_ASPECT_RATIO,
    Math.max(MIN_ASPECT_RATIO, Math.round(value * 100) / 100),
  )
}

export function clampCanvasWidthPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_CANVAS_WIDTH_PERCENT
  }
  return Math.min(
    MAX_CANVAS_WIDTH_PERCENT,
    Math.max(MIN_CANVAS_WIDTH_PERCENT, Math.round(value)),
  )
}

export const SNAP_GRID_PERCENT = 4
export const SNAP_THRESHOLD_PERCENT = 1.5

type SiblingRect = {
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}

function snapToNearest(
  value: number,
  candidates: readonly number[],
  threshold: number,
): number {
  let snapped = value
  let bestDelta = threshold
  for (const candidate of candidates) {
    const delta = Math.abs(candidate - value)
    if (delta < bestDelta) {
      bestDelta = delta
      snapped = candidate
    }
  }
  return snapped
}

function gridLines(step: number): number[] {
  const lines: number[] = []
  for (let value = 0; value <= 100; value += step) {
    lines.push(value)
  }
  return lines
}

/**
 * While dragging a tile, pulls its top-left corner onto the nearest grid line
 * or sibling edge (left/right edges for x, top/bottom edges for y) within
 * `threshold` percent, so admins get alignment without hand-nudging pixels.
 */
export function snapMovePosition(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number,
  siblings: readonly SiblingRect[],
  options?: { gridStep?: number; threshold?: number },
): { xPercent: number; yPercent: number } {
  const gridStep = options?.gridStep ?? SNAP_GRID_PERCENT
  const threshold = options?.threshold ?? SNAP_THRESHOLD_PERCENT
  const xCandidates = [...gridLines(gridStep), 100 - widthPercent]
  const yCandidates = [...gridLines(gridStep), 100 - heightPercent]
  for (const sibling of siblings) {
    const siblingRight = sibling.xPercent + sibling.widthPercent
    const siblingBottom = sibling.yPercent + sibling.heightPercent
    xCandidates.push(sibling.xPercent, siblingRight, siblingRight - widthPercent, sibling.xPercent - widthPercent)
    yCandidates.push(sibling.yPercent, siblingBottom, siblingBottom - heightPercent, sibling.yPercent - heightPercent)
  }
  return {
    xPercent: snapToNearest(xPercent, xCandidates, threshold),
    yPercent: snapToNearest(yPercent, yCandidates, threshold),
  }
}

/**
 * While resizing a tile from its bottom-right handle, pulls the right/bottom
 * edge onto the nearest grid line or sibling edge, same threshold as moving.
 */
export function snapResizeSize(
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number,
  siblings: readonly SiblingRect[],
  options?: { gridStep?: number; threshold?: number },
): { widthPercent: number; heightPercent: number } {
  const gridStep = options?.gridStep ?? SNAP_GRID_PERCENT
  const threshold = options?.threshold ?? SNAP_THRESHOLD_PERCENT
  const rightCandidates = gridLines(gridStep)
  const bottomCandidates = gridLines(gridStep)
  for (const sibling of siblings) {
    rightCandidates.push(sibling.xPercent, sibling.xPercent + sibling.widthPercent)
    bottomCandidates.push(sibling.yPercent, sibling.yPercent + sibling.heightPercent)
  }
  const snappedRight = snapToNearest(xPercent + widthPercent, rightCandidates, threshold)
  const snappedBottom = snapToNearest(yPercent + heightPercent, bottomCandidates, threshold)
  return {
    widthPercent: Math.max(8, snappedRight - xPercent),
    heightPercent: Math.max(8, snappedBottom - yPercent),
  }
}

export function fitPlacement(item: LayoutPlacement): LayoutPlacement {
  const widthPercent = Number.isFinite(item.widthPercent)
    ? Math.min(100, Math.max(8, item.widthPercent))
    : 8
  const heightPercent = Number.isFinite(item.heightPercent)
    ? Math.min(100, Math.max(8, item.heightPercent))
    : 8
  return {
    ...item,
    widthPercent,
    heightPercent,
    xPercent: clampPercent(item.xPercent, widthPercent),
    yPercent: clampPercent(item.yPercent, heightPercent),
  }
}

export function preferredColumnCount(count: number): number {
  if (count <= 1) {
    return 1
  }
  if (count <= 4) {
    return 2
  }
  if (count <= 9) {
    return 3
  }
  if (count <= 16) {
    return 4
  }
  return Math.ceil(Math.sqrt(count))
}

/** Same-size tiles, equal gaps, filling the canvas. */
export function arrangeEvenly(
  rentalAssetIds: readonly string[],
  columns?: number,
): LayoutPlacement[] {
  const count = rentalAssetIds.length
  if (count === 0) {
    return []
  }

  const cols = Math.max(1, columns ?? preferredColumnCount(count))
  const rows = Math.ceil(count / cols)
  const margin = 4
  const gap = 4
  const widthPercent =
    Math.round(((100 - margin * 2 - gap * (cols - 1)) / cols) * 10) / 10
  const heightPercent =
    Math.round(((100 - margin * 2 - gap * (rows - 1)) / rows) * 10) / 10

  return rentalAssetIds.map((rentalAssetId, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    return fitPlacement({
      rentalAssetId,
      xPercent: margin + col * (widthPercent + gap),
      yPercent: margin + row * (heightPercent + gap),
      widthPercent,
      heightPercent,
      zIndex: index,
    })
  })
}

export function autoPlaceItems(
  rentalAssetIds: readonly string[],
): LayoutPlacement[] {
  const widthPercent = 20
  const heightPercent = 10
  const columns = 4
  const horizontalGap = 4
  const verticalGap = 4
  const margin = 4

  return rentalAssetIds.map((rentalAssetId, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return fitPlacement({
      rentalAssetId,
      xPercent: margin + column * (widthPercent + horizontalGap),
      yPercent: margin + row * (heightPercent + verticalGap),
      widthPercent,
      heightPercent,
      zIndex: index,
    })
  })
}

/** Q-2 before Q-10. Generic for any resource name. */
export function compareResourceNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

export function orderByResourceName<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
): T[] {
  return [...items].sort((left, right) =>
    compareResourceNames(nameOf(left), nameOf(right)),
  )
}

type ReadableCanvasItem = {
  label: string
  xPercent: number
  yPercent: number
}

/**
 * Screen-reader and tab order follow the picture: top to bottom, then left
 * to right. Names break a tie with a natural sort.
 */
export function orderCanvasItemsForReading<T extends ReadableCanvasItem>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => {
    const row = left.yPercent - right.yPercent
    if (Math.abs(row) > 0.05) {
      return row
    }

    const column = left.xPercent - right.xPercent
    if (Math.abs(column) > 0.05) {
      return column
    }

    return compareResourceNames(left.label, right.label)
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
