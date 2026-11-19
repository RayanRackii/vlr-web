import { addCivilDays } from "@/features/catalog/components/agenda/agendaLayout"
import { tenantCivilDateTime, tenantCivilInstant } from "@/lib/tenantTimeZone"
import type {
  AllocationKind,
  AllocationPreview,
  CreateAllocationRequest,
  PlanningAllocation,
  PlanningConflict,
  UpdateAllocationRequest,
} from "../schemas/planningSchemas"

/** Longest work window of one allocation (30 days, as the API enforces). */
export const MAX_WORK_MINUTES = 43_200
export const MAX_BUFFER_MINUTES = 1_440
export const TITLE_MAX_LENGTH = 200
export const NOTES_MAX_LENGTH = 1_000

export type AllocationFormValues = {
  assetId: string
  kind: AllocationKind
  title: string
  notes: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  prepMinutes: string
  cleanupMinutes: string
}

export type AllocationPrefill = {
  assetId?: string | null
  /** Civil date, `YYYY-MM-DD`. */
  date: string
  /** `HH:mm` */
  startTime?: string
  kind?: AllocationKind
}

export type FormErrorKey = "asset" | "title" | "start" | "end" | "order" | "tooLong" | "prep" | "cleanup"
export type FormErrors = Partial<Record<FormErrorKey, true>>

function clockMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour < 24 && minute < 60 ? hour * 60 + minute : null
}

function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Civil date and clock plus `minutes`, rolling over days. */
export function addMinutesToCivil(date: string, time: string, minutes: number): { date: string; time: string } {
  const start = clockMinutes(time) ?? 0
  const total = start + minutes
  const dayShift = Math.floor(total / 1440)
  const rest = ((total % 1440) + 1440) % 1440
  return { date: addCivilDays(date, dayShift), time: `${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}` }
}

export function initialValues(prefill: AllocationPrefill): AllocationFormValues {
  const startTime = prefill.startTime ?? "08:00"
  const end = addMinutesToCivil(prefill.date, startTime, 60)
  return {
    assetId: prefill.assetId ?? "",
    kind: prefill.kind ?? "Use",
    title: "",
    notes: "",
    startDate: prefill.date,
    startTime,
    endDate: end.date,
    endTime: end.time,
    prepMinutes: "",
    cleanupMinutes: "",
  }
}

const minutesBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 60_000)

export function valuesFromAllocation(allocation: PlanningAllocation, zone: string): AllocationFormValues {
  const start = tenantCivilDateTime(new Date(allocation.plannedWorkStart), zone)
  const end = tenantCivilDateTime(new Date(allocation.plannedWorkEnd), zone)
  const prep = minutesBetween(allocation.occupiedStart, allocation.plannedWorkStart)
  const cleanup = minutesBetween(allocation.plannedWorkEnd, allocation.occupiedEnd)
  return {
    assetId: allocation.assetId,
    kind: allocation.kind === "Unavailable" ? "Unavailable" : "Use",
    title: allocation.title,
    notes: allocation.notes,
    startDate: start.date,
    startTime: start.time.slice(0, 5),
    endDate: end.date,
    endTime: end.time.slice(0, 5),
    prepMinutes: prep > 0 ? String(prep) : "",
    cleanupMinutes: cleanup > 0 ? String(cleanup) : "",
  }
}

function parseBuffer(raw: string): number | null | "invalid" {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  if (!/^\d+$/.test(trimmed)) return "invalid"
  const value = Number(trimmed)
  return value > MAX_BUFFER_MINUTES ? "invalid" : value
}

/** The work window as instants, or null when a date or clock is missing or not real. */
export function workWindow(values: AllocationFormValues, zone: string): { start: Date; end: Date } | null {
  if (!isCivilDate(values.startDate) || !isCivilDate(values.endDate)) return null
  if (clockMinutes(values.startTime) === null || clockMinutes(values.endTime) === null) return null
  return {
    start: tenantCivilInstant(values.startDate, `${values.startTime}:00`, zone),
    end: tenantCivilInstant(values.endDate, `${values.endTime}:00`, zone),
  }
}

export function validate(values: AllocationFormValues, zone: string): FormErrors {
  const errors: FormErrors = {}
  if (!values.assetId) errors.asset = true
  if (!values.title.trim()) errors.title = true
  if (parseBuffer(values.prepMinutes) === "invalid") errors.prep = true
  if (parseBuffer(values.cleanupMinutes) === "invalid") errors.cleanup = true
  const window = workWindow(values, zone)
  if (!window) {
    if (!isCivilDate(values.startDate) || clockMinutes(values.startTime) === null) errors.start = true
    if (!isCivilDate(values.endDate) || clockMinutes(values.endTime) === null) errors.end = true
  } else if (window.end.getTime() <= window.start.getTime()) {
    errors.order = true
  } else if ((window.end.getTime() - window.start.getTime()) / 60_000 > MAX_WORK_MINUTES) {
    errors.tooLong = true
  }
  return errors
}

export const isValid = (errors: FormErrors) => Object.keys(errors).length === 0

function buffer(raw: string): number | null {
  const parsed = parseBuffer(raw)
  return parsed === "invalid" ? null : parsed
}

/** Body for preview and create; null while the window or buffers are not usable (the title is not needed to preview). */
export function toCreateRequest(values: AllocationFormValues, zone: string): CreateAllocationRequest | null {
  const errors = validate(values, zone)
  if (errors.asset || errors.start || errors.end || errors.order || errors.tooLong || errors.prep || errors.cleanup) return null
  const window = workWindow(values, zone)
  if (!window) return null
  return {
    assetId: values.assetId,
    kind: values.kind,
    title: values.title.trim(),
    notes: values.notes.trim() || null,
    workStart: window.start.toISOString(),
    workEnd: window.end.toISOString(),
    prepMinutes: buffer(values.prepMinutes),
    cleanupMinutes: buffer(values.cleanupMinutes),
  }
}

export function toUpdateRequest(values: AllocationFormValues, zone: string, expectedVersion: string): UpdateAllocationRequest | null {
  const create = toCreateRequest(values, zone)
  if (!create) return null
  return {
    expectedVersion,
    title: create.title,
    notes: create.notes ?? "",
    workStart: create.workStart,
    workEnd: create.workEnd,
    prepMinutes: create.prepMinutes ?? 0,
    cleanupMinutes: create.cleanupMinutes ?? 0,
  }
}

export type PreviewView = {
  feasible: boolean
  conflicts: PlanningConflict[]
  hoursViolation: string | null
}

/**
 * Reads a preview for the form. The preview endpoint knows nothing about the allocation being
 * edited, so that allocation would conflict with itself: drop it before deciding.
 */
export function previewView(preview: AllocationPreview, editingId: string | null): PreviewView {
  const conflicts = editingId ? preview.conflicts.filter((conflict) => conflict.allocationId !== editingId) : preview.conflicts
  return { conflicts, hoursViolation: preview.hoursViolation, feasible: conflicts.length === 0 && !preview.hoursViolation }
}

/** Stable key of what the preview depends on, so equal inputs reuse one call. */
export function previewKey(request: CreateAllocationRequest | null): string | null {
  return request ? JSON.stringify([request.assetId, request.kind, request.workStart, request.workEnd, request.prepMinutes ?? null, request.cleanupMinutes ?? null]) : null
}
