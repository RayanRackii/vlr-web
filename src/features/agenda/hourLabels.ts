const LABEL_WIDTH = 48
const LABEL_GAP = 8

export type HourLabel = {
  minutes: number
  /** Position of the tick, 0–100 across the axis. */
  leftPct: number
  align: "start" | "center" | "end"
}

/**
 * Hour ticks for the day axis. Midnight at the end of the day is not labeled
 * (no 24:00). End ticks stay, and any label that would collide is skipped.
 */
export function visibleHourLabels(startMinutes: number, endMinutes: number, widthPx: number): HourLabel[] {
  const start = Math.floor(startMinutes / 60) * 60
  const end = Math.max(start + 60, Math.ceil(endMinutes / 60) * 60)
  const span = end - start
  const marks: number[] = []
  for (let minutes = start; minutes <= end; minutes += 60) {
    if (minutes >= 24 * 60) continue
    marks.push(minutes)
  }
  if (marks.length === 0) return []

  const width = widthPx > 0 ? widthPx : 0
  const chosen: HourLabel[] = []
  const boxes: [number, number][] = []
  const order = [marks[0], marks[marks.length - 1], ...marks.slice(1, -1)]
  const seen = new Set<number>()

  for (const minutes of order) {
    if (seen.has(minutes)) continue
    seen.add(minutes)
    const leftPct = ((minutes - start) / span) * 100
    const align: HourLabel["align"] = minutes <= start ? "start" : end - minutes < 60 ? "end" : "center"
    if (width > 0) {
      const x = (leftPct / 100) * width
      const box: [number, number] = align === "start"
        ? [x, x + LABEL_WIDTH]
        : align === "end"
          ? [x - LABEL_WIDTH, x]
          : [x - LABEL_WIDTH / 2, x + LABEL_WIDTH / 2]
      const hits = boxes.some(([left, right]) => box[0] < right + LABEL_GAP && box[1] + LABEL_GAP > left)
      if (hits) continue
      boxes.push(box)
    } else if (minutes !== marks[0] && minutes !== marks[marks.length - 1]) {
      continue
    }
    chosen.push({ minutes, leftPct, align })
  }

  return chosen.sort((a, b) => a.minutes - b.minutes)
}
