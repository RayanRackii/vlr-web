import { addCivilDays, zonedDayAndMinutes } from "@/features/catalog/components/agenda/agendaLayout"
import { tenantCivilInstant } from "@/lib/tenantTimeZone"
import type { PlanningAgenda, PlanningAgendaResource, PlanningAllocation, WorkingWindow } from "../schemas/planningSchemas"

export const DAY_MINUTES = 24 * 60

/** Half-open span of minutes inside one civil day. */
export type Segment = { start: number; end: number }

export type BlockTone = "scheduled" | "running" | "cleaning" | "released" | "unavailable"

export type PlacedBlock = {
  key: string
  allocation: PlanningAllocation
  resourceId: string
  /** Minutes inside the civil day, clipped to it. */
  start: number
  end: number
  leftPct: number
  widthPct: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
  tone: BlockTone
  expired: boolean
  overdue: boolean
  /** Share of the bar (0..1) taken by prep, work and cleanup. */
  segments: { prep: number; work: number; cleanup: number }
}

export type DayRowModel = {
  resource: PlanningAgendaResource
  /** Non-working time (shading). Empty for round-the-clock assets. */
  closed: Segment[]
  /** Anonymous customer reservations on rental-backed assets. */
  external: Segment[]
  blocks: PlacedBlock[]
  laneCount: number
}

export type WeekCellModel = {
  date: string
  blocks: PlacedBlock[]
  busyMinutes: number
  closedAllDay: boolean
}

export type WeekRowModel = { resource: PlanningAgendaResource; cells: WeekCellModel[] }

export function clockToMinutes(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(clock.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 24 || minute > 59 || (hour === 24 && minute !== 0)) return null
  return hour * 60 + minute
}

/** 0 = Sunday, like the API's day_of_week. */
export function weekdayOf(civil: string): number {
  const [year, month, day] = civil.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function mergeSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments].filter((s) => s.end > s.start).sort((a, b) => a.start - b.start)
  const merged: Segment[] = []
  for (const segment of sorted) {
    const last = merged[merged.length - 1]
    if (last && segment.start <= last.end) last.end = Math.max(last.end, segment.end)
    else merged.push({ ...segment })
  }
  return merged
}

/** Working windows of a civil day, or null when the asset has no hours rule (always open). */
export function workingSegments(resource: Pick<PlanningAgendaResource, "hoursPolicy" | "workingHours">, date: string): Segment[] | null {
  if (!resource.hoursPolicy || resource.hoursPolicy === "Anytime") return null
  const weekday = weekdayOf(date)
  const segments: Segment[] = []
  for (const window of resource.workingHours as readonly WorkingWindow[]) {
    if (window.dayOfWeek !== weekday) continue
    const open = clockToMinutes(window.openTime)
    const rawClose = clockToMinutes(window.closeTime)
    if (open === null || rawClose === null) continue
    // Same reading as the API: close at 23:59 or later is the end of the day; close <= open (including 00:00) is skipped.
    const close = rawClose >= 23 * 60 + 59 ? DAY_MINUTES : rawClose
    if (close <= open) continue
    segments.push({ start: open, end: close })
  }
  return mergeSegments(segments)
}

/** Non-working time of a civil day: the complement of the working windows. */
export function closedSegments(resource: Pick<PlanningAgendaResource, "hoursPolicy" | "workingHours">, date: string): Segment[] {
  const open = workingSegments(resource, date)
  if (open === null) return []
  const closed: Segment[] = []
  let cursor = 0
  for (const segment of open) {
    if (segment.start > cursor) closed.push({ start: cursor, end: segment.start })
    cursor = Math.max(cursor, segment.end)
  }
  if (cursor < DAY_MINUTES) closed.push({ start: cursor, end: DAY_MINUTES })
  return closed
}

/** Part of [start, end) that falls on `date` in `zone`, as minutes of that day. */
export function dayWindow(start: string, end: string, date: string, zone: string): Segment | null {
  if (Date.parse(end) <= Date.parse(start)) return null
  const a = zonedDayAndMinutes(start, zone)
  const b = zonedDayAndMinutes(end, zone)
  if (!a || !b || a.dayKey > date || b.dayKey < date) return null
  const left = a.dayKey < date ? 0 : a.minutes
  const right = b.dayKey > date ? DAY_MINUTES : b.minutes
  return right > left ? { start: left, end: right } : null
}

export function blockTone(allocation: Pick<PlanningAllocation, "kind" | "status">): BlockTone {
  if (allocation.kind === "Unavailable") return "unavailable"
  if (allocation.status === "Running") return "running"
  if (allocation.status === "Cleaning") return "cleaning"
  if (allocation.status === "Released") return "released"
  return "scheduled"
}

/**
 * The span an allocation takes on the grid. A started allocation holds the asset until it is
 * released (the API blocks it with no end), so once it is past its end it is drawn to the end of the
 * visible range, and reported as extended (overdue).
 */
export function effectiveWindow(allocation: PlanningAllocation, nowMs: number, rangeEndMs: number): { start: string; end: string; extended: boolean } {
  let start = allocation.occupiedStart
  let end = allocation.occupiedEnd
  const held = allocation.status === "Running" || allocation.status === "Cleaning"
  if (held && allocation.actualStartAt && Date.parse(allocation.actualStartAt) < Date.parse(start)) start = allocation.actualStartAt
  const extended = held && (allocation.isOverdue || nowMs > Date.parse(end))
  if (extended && rangeEndMs > Date.parse(end)) end = new Date(rangeEndMs).toISOString()
  return { start, end, extended }
}

function segmentsOf(allocation: PlanningAllocation, window: Segment, date: string, zone: string): PlacedBlock["segments"] {
  const total = window.end - window.start
  if (total <= 0) return { prep: 0, work: 1, cleanup: 0 }
  const work = dayWindow(allocation.plannedWorkStart, allocation.plannedWorkEnd, date, zone)
  if (!work) return { prep: 0, work: 1, cleanup: 0 }
  const workStart = Math.min(Math.max(work.start, window.start), window.end)
  const workEnd = Math.min(Math.max(work.end, workStart), window.end)
  return {
    prep: (workStart - window.start) / total,
    work: (workEnd - workStart) / total,
    cleanup: (window.end - workEnd) / total,
  }
}

/** Stacks overlapping blocks into lanes (first fit by start time). */
export function assignLanes<T extends { start: number; end: number; lane: number }>(blocks: T[]): number {
  const laneEnds: number[] = []
  const ordered = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end)
  for (const block of ordered) {
    let lane = laneEnds.findIndex((end) => end <= block.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = block.end
    block.lane = lane
  }
  return Math.max(laneEnds.length, 1)
}

function placeBlock(allocation: PlanningAllocation, resource: PlanningAgendaResource, date: string, zone: string, nowMs: number, rangeEndMs: number): PlacedBlock | null {
  const span = effectiveWindow(allocation, nowMs, rangeEndMs)
  const window = dayWindow(span.start, span.end, date, zone)
  if (!window) return null
  const startsBefore = (zonedDayAndMinutes(span.start, zone)?.dayKey ?? date) < date
  const endsAfter = (zonedDayAndMinutes(span.end, zone)?.dayKey ?? date) > date
  return {
    key: `${allocation.id}:${date}`,
    allocation,
    resourceId: resource.assetId,
    start: window.start,
    end: window.end,
    leftPct: (window.start / DAY_MINUTES) * 100,
    widthPct: ((window.end - window.start) / DAY_MINUTES) * 100,
    lane: 0,
    continuesBefore: startsBefore,
    continuesAfter: endsAfter,
    tone: blockTone(allocation),
    expired: allocation.isExpired,
    overdue: allocation.isOverdue || span.extended,
    segments: segmentsOf(allocation, window, date, zone),
  }
}

function zoneOf(resource: PlanningAgendaResource, fallback: string) {
  return resource.timeZoneId || fallback
}

function blocksFor(agenda: PlanningAgenda, resource: PlanningAgendaResource, date: string, fallbackZone: string, nowMs: number): PlacedBlock[] {
  const zone = zoneOf(resource, fallbackZone)
  return agenda.items
    .filter((item) => item.assetId === resource.assetId && item.status !== "Cancelled")
    .flatMap((item) => placeBlock(item, resource, date, zone, nowMs, Date.parse(agenda.to)) ?? [])
}

export function buildDayModel(agenda: PlanningAgenda, date: string, fallbackZone: string, nowMs: number): DayRowModel[] {
  return agenda.resources.map((resource) => {
    const zone = zoneOf(resource, fallbackZone)
    const blocks = blocksFor(agenda, resource, date, fallbackZone, nowMs)
    const laneCount = assignLanes(blocks)
    const external = mergeSegments(agenda.externalBusy
      .filter((busy) => busy.assetId === resource.assetId)
      .flatMap((busy) => dayWindow(busy.start, busy.end, date, zone) ?? []))
    return { resource, closed: closedSegments(resource, date), external, blocks, laneCount }
  })
}

export function buildWeekModel(agenda: PlanningAgenda, weekStart: string, fallbackZone: string, nowMs: number): { days: string[]; rows: WeekRowModel[] } {
  const days = Array.from({ length: 7 }, (_, index) => addCivilDays(weekStart, index))
  const rows = agenda.resources.map((resource) => ({
    resource,
    cells: days.map((date): WeekCellModel => {
      const blocks = blocksFor(agenda, resource, date, fallbackZone, nowMs).sort((a, b) => a.start - b.start)
      const busy = mergeSegments(blocks.map((block) => ({ start: block.start, end: block.end })))
      const open = workingSegments(resource, date)
      return {
        date,
        blocks,
        busyMinutes: busy.reduce((sum, segment) => sum + segment.end - segment.start, 0),
        closedAllDay: open !== null && open.length === 0,
      }
    }),
  }))
  return { days, rows }
}

/** Instants spanning the given civil days in the tenant zone, for the agenda query. */
export function agendaRange(firstDay: string, lastDay: string, zone: string): { from: string; to: string } {
  return {
    from: tenantCivilInstant(firstDay, "00:00:00", zone).toISOString(),
    to: tenantCivilInstant(addCivilDays(lastDay, 1), "00:00:00", zone).toISOString(),
  }
}

/** Snaps a position on a day row (0..1) to a clock time in steps of `step` minutes. */
export function minutesAtFraction(fraction: number, step = 30): number {
  const raw = Math.min(Math.max(fraction, 0), 1) * DAY_MINUTES
  return Math.min(Math.floor(raw / step) * step, DAY_MINUTES - step)
}

export function formatMinutes(minutes: number): string {
  const bounded = Math.min(Math.max(minutes, 0), DAY_MINUTES)
  const hour = Math.floor(bounded / 60) % 24
  return `${String(hour).padStart(2, "0")}:${String(bounded % 60).padStart(2, "0")}`
}

export function summarize(agenda: PlanningAgenda): { resources: number; allocations: number; overdue: number; expired: number } {
  const live = agenda.items.filter((item) => item.status !== "Cancelled")
  return {
    resources: agenda.resources.length,
    allocations: live.length,
    overdue: live.filter((item) => item.isOverdue).length,
    expired: live.filter((item) => item.isExpired).length,
  }
}
