import { slotDurationMinutes } from "@/features/tenantPortal/lib/agendaDurationSelection"
import {
  formatScheduleTime,
  type AdminRentalAsset,
  type DayOfWeekName,
  type ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"
import { HH_MM } from "@/lib/time24"

/** Weekdays in the order owners read them (Monday first). */
export const WEEK_ORDER: readonly DayOfWeekName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

export const DEFAULT_OPEN_TIME = "08:00"
export const DEFAULT_CLOSE_TIME = "18:00"
export const DEFAULT_SLOT_MINUTES = 60
export const SLOT_PRESETS = [30, 60, 90, 120] as const

export type HoursRow = {
  open: boolean
  openTime: string
  closeTime: string
  /** The selected resources disagree on this weekday. Untouched, the row is skipped on save. */
  mixed: boolean
  /** The user changed this row since the last load. */
  touched: boolean
}

export type BusinessHoursDraft = {
  days: Record<DayOfWeekName, HoursRow>
  /** Null while the selected resources use different durations and none was chosen. */
  slotMinutes: number | null
  slotMixed: boolean
  slotTouched: boolean
}

export type HoursGroup = {
  days: DayOfWeekName[]
  openTime: string
  closeTime: string
}

export type HoursRemoval = {
  template: ScheduleTemplate
  /**
   * "closed": the weekday was switched off. "outside": the slot lies outside the new hours.
   * "replace": the slot overlaps the new hours but is not part of the new grid (replace semantics).
   */
  reason: "closed" | "outside" | "replace"
}

export type BusinessHoursPlan = {
  rentalAssetIds: string[]
  groups: HoursGroup[]
  slotMinutes: number
  removals: HoursRemoval[]
  /** Weekdays skipped because templates of another occupancy kind overlap the new hours. */
  conflicts: DayOfWeekName[]
  /** Overall open/close for resources that keep hours on the asset itself. Null when nothing is open. */
  policyHours: { openTime: string; closeTime: string } | null
}

export type PlanProblem = "invalidTimes" | "slotRequired" | "invalidSlot"

function toMinutes(value: string, isEnd = false): number {
  const [hour = "0", minute = "0"] = value.split(":")
  const total = Number(hour) * 60 + Number(minute)
  return isEnd && total === 0 ? 24 * 60 : total
}

function emptyRow(): HoursRow {
  return { open: false, openTime: "", closeTime: "", mixed: false, touched: false }
}

function activeTemplates(
  templates: readonly ScheduleTemplate[],
  assetId: string,
  day: DayOfWeekName,
) {
  return templates.filter(
    (template) =>
      template.isActive && template.rentalAssetId === assetId && template.dayOfWeek === day,
  )
}

function assetDaySignature(
  asset: AdminRentalAsset,
  templates: readonly ScheduleTemplate[],
  day: DayOfWeekName,
): string {
  const rows = activeTemplates(templates, asset.id, day)
  if (rows.length > 0) {
    const open = rows.reduce((min, row) => (toMinutes(row.startTime) < toMinutes(min) ? row.startTime : min), rows[0].startTime)
    const close = rows.reduce((max, row) => (toMinutes(row.endTime, true) > toMinutes(max, true) ? row.endTime : max), rows[0].endTime)
    return `${formatScheduleTime(open)}-${formatScheduleTime(close)}`
  }
  if ((asset.schedulePolicy ?? "SlotGrid") === "OpenHours" && asset.openTime && asset.closeTime) {
    return `${formatScheduleTime(asset.openTime)}-${formatScheduleTime(asset.closeTime)}`
  }
  return "closed"
}

/** Business hours the selected resources already have, one row per weekday. */
export function deriveBusinessHours(
  assets: readonly AdminRentalAsset[],
  templates: readonly ScheduleTemplate[],
): BusinessHoursDraft {
  const days = {} as Record<DayOfWeekName, HoursRow>
  for (const day of WEEK_ORDER) {
    const signatures = new Set(assets.map((asset) => assetDaySignature(asset, templates, day)))
    if (signatures.size > 1) {
      days[day] = { ...emptyRow(), mixed: true }
      continue
    }
    const [only] = [...signatures]
    if (!only || only === "closed") {
      days[day] = emptyRow()
      continue
    }
    const [openTime, closeTime] = only.split("-")
    days[day] = { open: true, openTime, closeTime, mixed: false, touched: false }
  }

  const selectedIds = new Set(assets.map((asset) => asset.id))
  const durations = new Set(
    templates
      .filter((template) => template.isActive && selectedIds.has(template.rentalAssetId))
      .map((template) => slotDurationMinutes(template))
      .filter((value) => value > 0),
  )
  const slotMixed = durations.size > 1
  const slotMinutes = slotMixed ? null : ([...durations][0] ?? DEFAULT_SLOT_MINUTES)
  return { days, slotMinutes, slotMixed, slotTouched: false }
}

export function isRowComplete(row: HoursRow): boolean {
  return HH_MM.test(row.openTime) && HH_MM.test(row.closeTime) && toMinutes(row.openTime) < toMinutes(row.closeTime, true)
}

function rowNeedsSave(row: HoursRow, slotTouched: boolean): boolean {
  if (row.mixed && !row.touched) return false
  return row.touched || (slotTouched && row.open)
}

export function isDraftDirty(draft: BusinessHoursDraft): boolean {
  return draft.slotTouched || WEEK_ORDER.some((day) => draft.days[day].touched)
}

/** Everything that blocks Save, or null when the draft can be applied. */
export function draftProblem(draft: BusinessHoursDraft): PlanProblem | null {
  const rows = WEEK_ORDER.map((day) => draft.days[day]).filter((row) => rowNeedsSave(row, draft.slotTouched))
  if (rows.some((row) => row.open && !isRowComplete(row))) return "invalidTimes"
  if (rows.some((row) => row.open)) {
    if (draft.slotMinutes === null) return "slotRequired"
    if (!Number.isInteger(draft.slotMinutes) || draft.slotMinutes < 1) return "invalidSlot"
  }
  return null
}

/**
 * Turns the draft into the calls to make: weekdays with identical hours share one
 * weekly-rule call, switched-off weekdays and slots outside the new hours are removed.
 */
export function buildBusinessHoursPlan(
  draft: BusinessHoursDraft,
  rentalAssetIds: readonly string[],
  templates: readonly ScheduleTemplate[],
  openKindId: string,
): BusinessHoursPlan {
  const selected = new Set(rentalAssetIds)
  const groups = new Map<string, HoursGroup>()
  const removals: HoursRemoval[] = []
  const conflicts: DayOfWeekName[] = []
  const slot = draft.slotMinutes ?? DEFAULT_SLOT_MINUTES

  for (const day of WEEK_ORDER) {
    const row = draft.days[day]
    if (!rowNeedsSave(row, draft.slotTouched)) continue
    const dayTemplates = templates.filter(
      (template) =>
        template.isActive && template.dayOfWeek === day && selected.has(template.rentalAssetId),
    )
    if (!row.open) {
      for (const template of dayTemplates) removals.push({ template, reason: "closed" })
      continue
    }
    const openAt = toMinutes(row.openTime)
    const closeAt = toMinutes(row.closeTime, true)
    const overlaps = (template: ScheduleTemplate) =>
      toMinutes(template.startTime) < closeAt && toMinutes(template.endTime, true) > openAt
    // The API refuses a new slot that overlaps another kind, so that day is left alone.
    if (dayTemplates.some((template) => template.occupancyKindId !== openKindId && overlaps(template))) {
      conflicts.push(day)
      continue
    }
    const key = `${row.openTime}-${row.closeTime}`
    const group = groups.get(key) ?? { days: [], openTime: row.openTime, closeTime: row.closeTime }
    group.days.push(day)
    groups.set(key, group)
    for (const template of dayTemplates) {
      if (template.occupancyKindId !== openKindId) continue
      if (!overlaps(template)) {
        removals.push({ template, reason: "outside" })
        continue
      }
      const start = toMinutes(template.startTime)
      const end = toMinutes(template.endTime, true)
      const inGrid = end - start === slot && (start - openAt) % slot === 0 && start >= openAt && end <= closeAt
      if (!inGrid) removals.push({ template, reason: "replace" })
    }
  }

  const openRows = WEEK_ORDER.filter((day) => !conflicts.includes(day))
    .map((day) => draft.days[day])
    .filter((row) => row.open && isRowComplete(row) && !(row.mixed && !row.touched))
  const policyHours = openRows.length === 0
    ? null
    : {
        openTime: openRows.reduce((min, row) => (toMinutes(row.openTime) < toMinutes(min) ? row.openTime : min), openRows[0].openTime),
        closeTime: openRows.reduce((max, row) => (toMinutes(row.closeTime, true) > toMinutes(max, true) ? row.closeTime : max), openRows[0].closeTime),
      }

  return {
    rentalAssetIds: [...rentalAssetIds],
    groups: [...groups.values()],
    slotMinutes: slot,
    removals,
    conflicts,
    policyHours,
  }
}

/** Removals grouped by weekday for the confirmation list. */
export function summarizeRemovals(
  removals: readonly HoursRemoval[],
): { day: DayOfWeekName; reason: HoursRemoval["reason"]; count: number; resources: number }[] {
  const rows: { day: DayOfWeekName; reason: HoursRemoval["reason"]; ids: Set<string>; count: number }[] = []
  for (const removal of removals) {
    const day = removal.template.dayOfWeek as DayOfWeekName
    let row = rows.find((item) => item.day === day && item.reason === removal.reason)
    if (!row) {
      row = { day, reason: removal.reason, ids: new Set(), count: 0 }
      rows.push(row)
    }
    row.count += 1
    row.ids.add(removal.template.rentalAssetId)
  }
  rows.sort((a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day))
  return rows.map((row) => ({ day: row.day, reason: row.reason, count: row.count, resources: row.ids.size }))
}

/** One entry per weekday (Monday first): "HH:MM-HH:MM" or "closed". */
export function assetWeekSignature(
  asset: AdminRentalAsset,
  templates: readonly ScheduleTemplate[],
): string[] {
  return WEEK_ORDER.map((day) => assetDaySignature(asset, templates, day))
}

export type ScopeGroup = {
  ids: string[]
  /** Per weekday, Monday first. */
  signature: string[]
}

/** Resources with identical weekly hours, largest group first. */
export function groupAssetsByWeek(
  assets: readonly AdminRentalAsset[],
  templates: readonly ScheduleTemplate[],
): ScopeGroup[] {
  const groups = new Map<string, ScopeGroup>()
  for (const asset of assets) {
    const signature = assetWeekSignature(asset, templates)
    const key = signature.join("|")
    const group = groups.get(key) ?? { ids: [], signature }
    group.ids.push(asset.id)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.ids.length - a.ids.length)
}

/** Runs of consecutive weekdays that share the same hours (closed days are left out). */
export function summarizeWeek(
  signature: readonly string[],
): { first: DayOfWeekName; last: DayOfWeekName; hours: string }[] {
  const runs: { first: DayOfWeekName; last: DayOfWeekName; hours: string }[] = []
  signature.forEach((value, index) => {
    if (value === "closed") return
    const day = WEEK_ORDER[index]
    const hours = value.replace("-", "–")
    const previous = runs[runs.length - 1]
    if (previous && previous.hours === hours && WEEK_ORDER.indexOf(previous.last) === index - 1) {
      previous.last = day
    } else {
      runs.push({ first: day, last: day, hours })
    }
  })
  return runs
}
