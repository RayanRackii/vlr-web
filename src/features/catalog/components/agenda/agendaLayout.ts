import type {
  CatalogAgendaItem,
  CatalogAgendaResource,
} from "@/features/catalog/schemas/catalogSchemas"
import { resolveTenantTimeZone } from "@/lib/tenantTimeZone"

/** Visible timeline window (business hours). Occupied windows are clamped here. */
export const AGENDA_DAY_START_HOUR = 8
export const AGENDA_DAY_END_HOUR = 20
const WINDOW_START_MIN = AGENDA_DAY_START_HOUR * 60
const WINDOW_END_MIN = AGENDA_DAY_END_HOUR * 60
const WINDOW_SPAN_MIN = WINDOW_END_MIN - WINDOW_START_MIN

export type AgendaView = "week" | "day"

/** `YYYY-MM-DD` civil day plus minutes past midnight, in the given zone. */
export function zonedDayAndMinutes(
  iso: string,
  timeZoneId: string,
): { dayKey: string; minutes: number } | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTenantTimeZone(timeZoneId),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
  const hour = pick("hour") === "24" ? 0 : Number(pick("hour"))
  return {
    dayKey: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: hour * 60 + Number(pick("minute")),
  }
}

/** Today as a civil `YYYY-MM-DD` in the tenant zone (never relies on local midnight). */
export function civilToday(timeZoneId: string): string {
  return (
    zonedDayAndMinutes(new Date().toISOString(), timeZoneId)?.dayKey ??
    new Date().toISOString().slice(0, 10)
  )
}

function civilToUtc(civil: string): Date {
  const [y, m, d] = civil.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addCivilDays(civil: string, delta: number): string {
  const date = civilToUtc(civil)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/** Monday of the civil week containing `civil`. */
export function startOfCivilWeek(civil: string): string {
  const weekday = civilToUtc(civil).getUTCDay() // 0 = Sunday
  const backToMonday = (weekday + 6) % 7
  return addCivilDays(civil, -backToMonday)
}

export function buildDayColumns(anchor: string, view: AgendaView): string[] {
  if (view === "day") {
    return [anchor]
  }
  const monday = startOfCivilWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => addCivilDays(monday, index))
}

/** `HH:MM` for an instant on the tenant business clock. */
export function formatZonedTime(iso: string, locale: string, timeZoneId: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: resolveTenantTimeZone(timeZoneId),
  }).format(date)
}

export function formatDayLabel(civil: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(civilToUtc(civil))
}

/** Inclusive civil range → ISO instants spanning the columns (local-zone agnostic). */
export function columnsToRange(columns: string[]): { from: string; to: string } {
  const first = columns[0]
  const last = columns[columns.length - 1]
  return {
    from: `${first}T00:00:00.000Z`,
    to: `${addCivilDays(last, 1)}T00:00:00.000Z`,
  }
}

export type AgendaSegment = { kind: "prep" | "work" | "cleanup"; widthPct: number }

export type AgendaBlock = {
  item: CatalogAgendaItem
  key: string
  leftPct: number
  widthPct: number
  segments: AgendaSegment[]
  conflict: boolean
  /** Prep/work/cleanup instant ranges for the mobile stacked list (null when absent). */
  prep: [string, string] | null
  work: [string, string] | null
  cleanup: [string, string] | null
}

export type AgendaDay = {
  key: string
  label: string
  blocks: AgendaBlock[]
}

function overlaps(a: CatalogAgendaItem, b: CatalogAgendaItem): boolean {
  if (!a.occupiedStart || !a.occupiedEnd || !b.occupiedStart || !b.occupiedEnd) {
    return false
  }
  const aStart = new Date(a.occupiedStart).getTime()
  const aEnd = new Date(a.occupiedEnd).getTime()
  const bStart = new Date(b.occupiedStart).getTime()
  const bEnd = new Date(b.occupiedEnd).getTime()
  return aStart < bEnd && bStart < aEnd
}

/** Items in conflict: same resource, overlapping occupied windows. */
export function conflictingItems(items: CatalogAgendaItem[]): Set<string> {
  const conflicts = new Set<string>()
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]
      const b = items[j]
      if (a.rentalAssetId && a.rentalAssetId === b.rentalAssetId && overlaps(a, b)) {
        conflicts.add(a.orderId)
        conflicts.add(b.orderId)
      }
    }
  }
  return conflicts
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

/** Group agenda items into day columns, with timeline positions + buffer segments. */
export function buildAgendaDays(
  items: CatalogAgendaItem[],
  columns: string[],
  locale: string,
): AgendaDay[] {
  const conflicts = conflictingItems(items)
  return columns.map((key) => {
    const blocks: AgendaBlock[] = []
    for (const item of items) {
      const occStart = item.occupiedStart
        ? zonedDayAndMinutes(item.occupiedStart, item.timeZoneId)
        : null
      if (!occStart || occStart.dayKey !== key) {
        continue
      }
      const occEnd = item.occupiedEnd
        ? zonedDayAndMinutes(item.occupiedEnd, item.timeZoneId)
        : null
      const work = item.workStart ? zonedDayAndMinutes(item.workStart, item.timeZoneId) : null
      const workEnd = item.workEnd ? zonedDayAndMinutes(item.workEnd, item.timeZoneId) : null

      const startMin = clamp(occStart.minutes, WINDOW_START_MIN, WINDOW_END_MIN)
      const endMin = clamp(
        occEnd && occEnd.dayKey === key ? occEnd.minutes : WINDOW_END_MIN,
        startMin,
        WINDOW_END_MIN,
      )
      const totalMin = Math.max(endMin - startMin, 0)

      const segments: AgendaSegment[] = []
      if (totalMin > 0) {
        const workStartMin = work ? clamp(work.minutes, startMin, endMin) : startMin
        const workEndMin = workEnd ? clamp(workEnd.minutes, workStartMin, endMin) : endMin
        const prepPct = ((workStartMin - startMin) / totalMin) * 100
        const workPct = ((workEndMin - workStartMin) / totalMin) * 100
        const cleanupPct = Math.max(0, 100 - prepPct - workPct)
        if (prepPct > 0) segments.push({ kind: "prep", widthPct: prepPct })
        segments.push({ kind: "work", widthPct: work ? workPct : 100 - prepPct - cleanupPct })
        if (cleanupPct > 0) segments.push({ kind: "cleanup", widthPct: cleanupPct })
      }

      blocks.push({
        item,
        key: item.orderId,
        leftPct: (clamp(startMin - WINDOW_START_MIN, 0, WINDOW_SPAN_MIN) / WINDOW_SPAN_MIN) * 100,
        widthPct: Math.max((totalMin / WINDOW_SPAN_MIN) * 100, totalMin > 0 ? 2 : 0),
        segments,
        conflict: conflicts.has(item.orderId),
        prep:
          item.occupiedStart && item.workStart
            ? [item.occupiedStart, item.workStart]
            : null,
        work: item.workStart && item.workEnd ? [item.workStart, item.workEnd] : null,
        cleanup:
          item.workEnd && item.occupiedEnd ? [item.workEnd, item.occupiedEnd] : null,
      })
    }
    blocks.sort((a, b) => a.leftPct - b.leftPct)
    return { key, label: formatDayLabel(key, locale), blocks }
  })
}

export type AgendaResourceBlock = {
  item: CatalogAgendaItem
  key: string
  leftPct: number
  widthPct: number
  segments: AgendaSegment[]
}

export type AgendaResourceRow = {
  resource: CatalogAgendaResource
  blocks: AgendaResourceBlock[]
}

/** Prep/work/cleanup split as percentages of the full occupied block. */
function segmentsFromInstants(item: CatalogAgendaItem): AgendaSegment[] {
  const occStart = item.occupiedStart ? new Date(item.occupiedStart).getTime() : null
  const occEnd = item.occupiedEnd ? new Date(item.occupiedEnd).getTime() : null
  if (occStart == null || occEnd == null || occEnd <= occStart) {
    return [{ kind: "work", widthPct: 100 }]
  }
  const total = occEnd - occStart
  const workStart = clamp(item.workStart ? new Date(item.workStart).getTime() : occStart, occStart, occEnd)
  const workEnd = clamp(item.workEnd ? new Date(item.workEnd).getTime() : occEnd, workStart, occEnd)
  const prepPct = ((workStart - occStart) / total) * 100
  const workPct = ((workEnd - workStart) / total) * 100
  const cleanupPct = Math.max(0, 100 - prepPct - workPct)
  const segments: AgendaSegment[] = []
  if (prepPct > 0.01) segments.push({ kind: "prep", widthPct: prepPct })
  segments.push({ kind: "work", widthPct: workPct > 0.01 ? workPct : 100 - prepPct - cleanupPct })
  if (cleanupPct > 0.01) segments.push({ kind: "cleanup", widthPct: cleanupPct })
  return segments
}

/** One row per resource (empty rows kept); blocks positioned on the day/week track. */
export function buildResourceAgendaRows(
  items: CatalogAgendaItem[],
  resources: CatalogAgendaResource[],
  columns: string[],
  view: AgendaView,
): AgendaResourceRow[] {
  const colCount = Math.max(columns.length, 1)
  return resources.map((resource) => {
    const blocks: AgendaResourceBlock[] = []
    for (const item of items) {
      if (item.rentalAssetId !== resource.id || !item.occupiedStart) continue
      const occStart = zonedDayAndMinutes(item.occupiedStart, item.timeZoneId)
      if (!occStart) continue
      const dayIndex = columns.indexOf(occStart.dayKey)
      if (dayIndex === -1) continue

      let leftPct: number
      let widthPct: number
      if (view === "day") {
        const occEnd = item.occupiedEnd ? zonedDayAndMinutes(item.occupiedEnd, item.timeZoneId) : null
        const startMin = clamp(occStart.minutes, WINDOW_START_MIN, WINDOW_END_MIN)
        const endMin = clamp(
          occEnd && occEnd.dayKey === occStart.dayKey ? occEnd.minutes : WINDOW_END_MIN,
          startMin,
          WINDOW_END_MIN,
        )
        leftPct = ((startMin - WINDOW_START_MIN) / WINDOW_SPAN_MIN) * 100
        widthPct = Math.max(((endMin - startMin) / WINDOW_SPAN_MIN) * 100, 2)
      } else {
        leftPct = (dayIndex / colCount) * 100
        widthPct = (1 / colCount) * 100
      }

      blocks.push({ item, key: item.orderId, leftPct, widthPct, segments: segmentsFromInstants(item) })
    }
    blocks.sort((a, b) => a.leftPct - b.leftPct)
    return { resource, blocks }
  })
}

/** Hour marks (day view) or civil-day labels (week view) for the grid header. */
export function agendaColumnLabels(columns: string[], view: AgendaView, locale: string): string[] {
  if (view === "day") {
    return Array.from(
      { length: AGENDA_DAY_END_HOUR - AGENDA_DAY_START_HOUR },
      (_, index) => `${String(AGENDA_DAY_START_HOUR + index).padStart(2, "0")}h`,
    )
  }
  return columns.map((key) => formatDayLabel(key, locale))
}
