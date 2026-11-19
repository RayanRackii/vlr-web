import { normalizeTime24 } from "@/lib/time24"
import type { AssetProfile, HoursPolicy, PutAssetProfileRequest } from "../schemas/planningSchemas"
import { hoursPolicies } from "../schemas/planningSchemas"

/** Weekdays in the order owners read them (Monday first). Values follow the API: 0 is Sunday. */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const
export type WeekDay = (typeof WEEK_DAYS)[number]
/** Monday to Friday: the target of "copy to weekdays". */
export const WORK_WEEK: readonly WeekDay[] = [1, 2, 3, 4, 5]

export const DEFAULT_OPEN = "08:00"
export const DEFAULT_CLOSE = "18:00"
export const DEFAULT_POLICY: HoursPolicy = "StartWithinHours"
export const MAX_BUFFER_MINUTES = 24 * 60
const DAY_MINUTES = 24 * 60
/** The API reads a close at 23:59 or later as midnight (end of the day). */
const END_OF_DAY = 23 * 60 + 59

export type WindowDraft = { id: string; openTime: string; closeTime: string }
export type DayDraft = { windows: WindowDraft[] }

export type AvailabilityDraft = {
  isPlannable: boolean
  hoursPolicy: HoursPolicy
  capacity: number
  prepMinutes: string
  cleanupMinutes: string
  days: Record<WeekDay, DayDraft>
}

export type WindowProblem = "invalidTime" | "closeBeforeOpen" | "overlap"
export type DraftProblem = "hoursRequired" | "invalidBuffer" | "tooManyWindows"
/** Same cap as the API (MaxWorkingWindows). */
export const MAX_WINDOWS = 100

export type DraftValidation = {
  /** Problem of each window, by window id. */
  windows: Record<string, WindowProblem>
  draft: DraftProblem[]
  valid: boolean
}

let counter = 0
const nextId = () => `w${(counter += 1)}`

export const newWindow = (openTime = DEFAULT_OPEN, closeTime = DEFAULT_CLOSE): WindowDraft => ({ id: nextId(), openTime, closeTime })

const emptyDays = (): Record<WeekDay, DayDraft> =>
  ({ 0: { windows: [] }, 1: { windows: [] }, 2: { windows: [] }, 3: { windows: [] }, 4: { windows: [] }, 5: { windows: [] }, 6: { windows: [] } })

/** Policies the API names; anything else (a never-configured asset) starts on the default. */
function toPolicy(raw: string): HoursPolicy {
  return (hoursPolicies as readonly string[]).includes(raw) ? (raw as HoursPolicy) : DEFAULT_POLICY
}

/** "08:00:00" and "08:00" both become "08:00". */
const clock = (raw: string) => normalizeTime24(raw.slice(0, 5)) ?? raw.slice(0, 5)

export function draftFromProfile(profile: AssetProfile): AvailabilityDraft {
  const days = emptyDays()
  for (const window of profile.workingHours) {
    if (!(window.dayOfWeek in days)) continue
    days[window.dayOfWeek as WeekDay].windows.push({ id: nextId(), openTime: clock(window.openTime), closeTime: clock(window.closeTime) })
  }
  for (const day of WEEK_DAYS) days[day].windows.sort((a, b) => a.openTime.localeCompare(b.openTime))
  return {
    isPlannable: profile.isPlannable,
    // A profile that was never saved is plannable-off, but the day it is switched on it already starts on the default.
    hoursPolicy: profile.isConfigured ? toPolicy(profile.hoursPolicy) : DEFAULT_POLICY,
    capacity: profile.capacity > 0 ? profile.capacity : 1,
    prepMinutes: String(profile.defaultPrepMinutes),
    cleanupMinutes: String(profile.defaultCleanupMinutes),
    days,
  }
}

/** Minutes after midnight, or null when the text is not "HH:mm". */
export function toMinutes(value: string): number | null {
  const normalized = /^\d{2}:\d{2}$/.test(value) ? normalizeTime24(value) : null
  if (!normalized) return null
  const [hour, minute] = normalized.split(":").map(Number)
  return hour * 60 + minute
}

/** Close at 23:59 or later means midnight, as in the API. */
export const closeMinutes = (value: string): number | null => {
  const minutes = toMinutes(value)
  return minutes === null ? null : minutes >= END_OF_DAY ? DAY_MINUTES : minutes
}

function windowProblem(window: WindowDraft): WindowProblem | null {
  const open = toMinutes(window.openTime)
  const close = toMinutes(window.closeTime)
  if (open === null || close === null) return "invalidTime"
  // Raw times, like the API: close <= open is invalid, so 23:59-23:59 is rejected even though a 23:59 close reads as midnight.
  return close > open ? null : "closeBeforeOpen"
}

export function parseBuffer(raw: string): number | null {
  if (!/^\d{1,4}$/.test(raw.trim())) return null
  const value = Number(raw)
  return value <= MAX_BUFFER_MINUTES ? value : null
}

export function countWindows(draft: AvailabilityDraft): number {
  return WEEK_DAYS.reduce<number>((sum, day) => sum + draft.days[day].windows.length, 0)
}

export function hasWindows(draft: AvailabilityDraft): boolean {
  return WEEK_DAYS.some((day) => draft.days[day].windows.length > 0)
}

/** Policies that need hours on a plannable asset (API 422 `working_hours_required`). */
export const policyNeedsHours = (policy: HoursPolicy) => policy !== "Anytime"

/** Problem of every window that is unusable on its own or overlaps another window of the same day. */
function validateDraftWindows(draft: AvailabilityDraft): Record<string, WindowProblem> {
  const windows: Record<string, WindowProblem> = {}
  for (const day of WEEK_DAYS) {
    const own = draft.days[day].windows
    for (const window of own) {
      const problem = windowProblem(window)
      if (problem) windows[window.id] = problem
    }
    const usable = own.filter((window) => !windows[window.id])
    for (const a of usable) {
      const overlaps = usable.some((b) => b !== a && (toMinutes(a.openTime) as number) < (closeMinutes(b.closeTime) as number) && (toMinutes(b.openTime) as number) < (closeMinutes(a.closeTime) as number))
      if (overlaps) windows[a.id] = "overlap"
    }
  }
  return windows
}

/**
 * Stored hours are always checked, so a bad stored window is shown instead of being dropped.
 * "Hours required" only applies when they are actually used (plannable, policy other than Anytime).
 */
export function validateDraft(draft: AvailabilityDraft): DraftValidation {
  const problems: DraftProblem[] = []
  const windows = validateDraftWindows(draft)
  if (draft.isPlannable && policyNeedsHours(draft.hoursPolicy) && !hasWindows(draft)) problems.push("hoursRequired")
  if (countWindows(draft) > MAX_WINDOWS) problems.push("tooManyWindows")
  if (parseBuffer(draft.prepMinutes) === null || parseBuffer(draft.cleanupMinutes) === null) problems.push("invalidBuffer")
  return { windows, draft: problems, valid: problems.length === 0 && Object.keys(windows).length === 0 }
}

/** Copies the hours of one day onto Monday to Friday (the source day is left as is). */
export function copyToWeekdays(draft: AvailabilityDraft, source: WeekDay): AvailabilityDraft {
  const days = { ...draft.days }
  for (const day of WORK_WEEK) {
    if (day === source) continue
    days[day] = { windows: draft.days[source].windows.map((window) => ({ ...window, id: nextId() })) }
  }
  const next = { ...draft, days }
  // Over the cap the copy is refused, the draft stays as it was.
  return countWindows(next) > MAX_WINDOWS ? draft : next
}

export function addWindow(draft: AvailabilityDraft, day: WeekDay): AvailabilityDraft {
  if (countWindows(draft) >= MAX_WINDOWS) return draft
  const windows = draft.days[day].windows
  const last = windows[windows.length - 1]
  // A second window on the same day starts after the previous one closes, when there is room.
  const lastClose = last ? closeMinutes(last.closeTime) : null
  const fresh = lastClose !== null && lastClose < 22 * 60 ? newWindow(minutesToClock(lastClose + 60), minutesToClock(Math.min(lastClose + 180, END_OF_DAY))) : newWindow()
  return { ...draft, days: { ...draft.days, [day]: { windows: [...windows, fresh] } } }
}

export function updateWindow(draft: AvailabilityDraft, day: WeekDay, id: string, patch: Partial<Pick<WindowDraft, "openTime" | "closeTime">>): AvailabilityDraft {
  const windows = draft.days[day].windows.map((window) => (window.id === id ? { ...window, ...patch } : window))
  return { ...draft, days: { ...draft.days, [day]: { windows } } }
}

export function removeWindow(draft: AvailabilityDraft, day: WeekDay, id: string): AvailabilityDraft {
  return { ...draft, days: { ...draft.days, [day]: { windows: draft.days[day].windows.filter((window) => window.id !== id) } } }
}

/** Closed day to open (one default window) or open to closed (no windows). */
export function setDayOpen(draft: AvailabilityDraft, day: WeekDay, open: boolean): AvailabilityDraft {
  if (open && countWindows(draft) >= MAX_WINDOWS) return draft
  return { ...draft, days: { ...draft.days, [day]: { windows: open ? [newWindow()] : [] } } }
}

function minutesToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/**
 * Body for the PUT. The windows of the form are always sent (they start as the stored ones), so switching
 * to Anytime or turning plannable off keeps the hours; the API ignores them when they do not apply.
 * The caller only builds a request from a valid draft.
 */
export function toRequest(draft: AvailabilityDraft): PutAssetProfileRequest {
  const workingHours = WEEK_DAYS.flatMap((dayOfWeek) =>
    [...draft.days[dayOfWeek].windows]
      .sort((a, b) => (toMinutes(a.openTime) ?? 0) - (toMinutes(b.openTime) ?? 0))
      .map((window) => ({ dayOfWeek, openTime: window.openTime, closeTime: window.closeTime })),
  ).sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  return {
    isPlannable: draft.isPlannable,
    capacity: draft.capacity,
    hoursPolicy: draft.hoursPolicy,
    defaultPrepMinutes: parseBuffer(draft.prepMinutes) ?? 0,
    defaultCleanupMinutes: parseBuffer(draft.cleanupMinutes) ?? 0,
    workingHours,
  }
}
