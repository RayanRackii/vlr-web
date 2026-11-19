import { describe, expect, it } from "vitest"
import type { AllocationPreview, PlanningAllocation } from "../schemas/planningSchemas"
import {
  addMinutesToCivil,
  initialValues,
  isValid,
  previewKey,
  previewView,
  toCreateRequest,
  toUpdateRequest,
  validate,
  valuesFromAllocation,
  type AllocationFormValues,
} from "./allocationForm"

const ZONE = "America/Sao_Paulo" // UTC-3

const filled = (over: Partial<AllocationFormValues> = {}): AllocationFormValues => ({
  ...initialValues({ assetId: "a1", date: "2026-11-18", startTime: "09:00" }),
  title: "Peça A",
  ...over,
})

describe("initial values", () => {
  it("prefills a one hour window from the clicked cell", () => {
    expect(initialValues({ assetId: "a1", date: "2026-11-18", startTime: "09:30" })).toMatchObject({
      assetId: "a1", kind: "Use", startDate: "2026-11-18", startTime: "09:30", endDate: "2026-11-18", endTime: "10:30",
    })
  })

  it("rolls the end into the next day when the cell is the last hour", () => {
    expect(initialValues({ date: "2026-11-18", startTime: "23:30" })).toMatchObject({ endDate: "2026-11-19", endTime: "00:30" })
  })

  it("defaults to 08:00 and no asset from the toolbar", () => {
    expect(initialValues({ date: "2026-11-18" })).toMatchObject({ assetId: "", startTime: "08:00", endTime: "09:00" })
  })

  it("adds minutes across midnight", () => {
    expect(addMinutesToCivil("2026-12-31", "23:00", 120)).toEqual({ date: "2027-01-01", time: "01:00" })
  })
})

describe("validation", () => {
  it("accepts a complete form", () => {
    expect(isValid(validate(filled(), ZONE))).toBe(true)
  })

  it("requires asset and title", () => {
    expect(validate(filled({ assetId: "", title: "  " }), ZONE)).toEqual({ asset: true, title: true })
  })

  it("rejects an end that is not after the start", () => {
    expect(validate(filled({ endDate: "2026-11-18", endTime: "09:00" }), ZONE)).toEqual({ order: true })
    expect(validate(filled({ endDate: "2026-11-17", endTime: "12:00" }), ZONE)).toEqual({ order: true })
  })

  it("rejects missing or impossible dates and clocks", () => {
    expect(validate(filled({ startDate: "" }), ZONE).start).toBe(true)
    expect(validate(filled({ endTime: "" }), ZONE).end).toBe(true)
    expect(validate(filled({ startDate: "2026-02-30" }), ZONE).start).toBe(true)
  })

  it("rejects work longer than 30 days", () => {
    expect(validate(filled({ endDate: "2026-12-19", endTime: "09:01" }), ZONE).tooLong).toBe(true)
    expect(validate(filled({ endDate: "2026-12-18", endTime: "09:00" }), ZONE).tooLong).toBeUndefined()
  })

  it("rejects negative, fractional and absurd buffers but allows blanks", () => {
    expect(validate(filled({ prepMinutes: "-5" }), ZONE).prep).toBe(true)
    expect(validate(filled({ cleanupMinutes: "1.5" }), ZONE).cleanup).toBe(true)
    expect(validate(filled({ prepMinutes: "5000" }), ZONE).prep).toBe(true)
    expect(isValid(validate(filled({ prepMinutes: "", cleanupMinutes: "15" }), ZONE))).toBe(true)
  })
})

describe("request body", () => {
  it("converts the tenant wall clock to instants and trims text", () => {
    const body = toCreateRequest(filled({ title: "  Peça A ", notes: " nota ", prepMinutes: "10", cleanupMinutes: "" }), ZONE)
    expect(body).toEqual({
      assetId: "a1", kind: "Use", title: "Peça A", notes: "nota",
      workStart: "2026-11-18T12:00:00.000Z", workEnd: "2026-11-18T13:00:00.000Z", prepMinutes: 10, cleanupMinutes: null,
    })
  })

  it("returns null while the window is unusable, but not while only the title is missing (preview needs no title)", () => {
    expect(toCreateRequest(filled({ endDate: "2026-11-17" }), ZONE)).toBeNull()
    expect(toCreateRequest(filled({ assetId: "" }), ZONE)).toBeNull()
    expect(toCreateRequest(filled({ title: "" }), ZONE)).not.toBeNull()
  })

  it("builds the patch with the version and zeroes cleared buffers", () => {
    expect(toUpdateRequest(filled({ notes: "" }), ZONE, "AAAA")).toEqual({
      expectedVersion: "AAAA", title: "Peça A", notes: "", workStart: "2026-11-18T12:00:00.000Z", workEnd: "2026-11-18T13:00:00.000Z", prepMinutes: 0, cleanupMinutes: 0,
    })
  })

  it("keys the preview by what it depends on, not by the title", () => {
    const a = toCreateRequest(filled({ title: "A" }), ZONE)
    const b = toCreateRequest(filled({ title: "B" }), ZONE)
    const c = toCreateRequest(filled({ endTime: "11:00" }), ZONE)
    expect(previewKey(a)).toBe(previewKey(b))
    expect(previewKey(a)).not.toBe(previewKey(c))
    expect(previewKey(null)).toBeNull()
  })
})

describe("editing", () => {
  const stored: PlanningAllocation = {
    id: "x1", assetId: "a1", assetName: "Impressora", unitId: "u", kind: "Use", title: "Peça A", notes: "obs", quantity: 1,
    plannedWorkStart: "2026-11-18T13:00:00.000Z", plannedWorkEnd: "2026-11-18T15:00:00.000Z",
    occupiedStart: "2026-11-18T12:45:00.000Z", occupiedEnd: "2026-11-18T15:30:00.000Z",
    timeZoneId: ZONE, status: "Scheduled", source: "Manual", referenceLabel: "", createdByUserId: null, cancelReason: "",
    actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, isBlocking: true, isExpired: false, isOverdue: false, version: "AAAA",
  }

  it("round-trips an allocation into form values, reading prep and cleanup from the occupied window", () => {
    expect(valuesFromAllocation(stored, ZONE)).toEqual({
      assetId: "a1", kind: "Use", title: "Peça A", notes: "obs",
      startDate: "2026-11-18", startTime: "10:00", endDate: "2026-11-18", endTime: "12:00", prepMinutes: "15", cleanupMinutes: "30",
    })
  })

  it("rebuilds the same window", () => {
    const body = toCreateRequest(valuesFromAllocation(stored, ZONE), ZONE)
    expect(body?.workStart).toBe(stored.plannedWorkStart)
    expect(body?.workEnd).toBe(stored.plannedWorkEnd)
  })
})

describe("preview reading", () => {
  const conflict = (allocationId: string | null) => ({ source: "allocation", allocationId, start: "2026-11-18T12:00:00.000Z", end: "2026-11-18T13:00:00.000Z", label: "Outra" })
  const preview = (over: Partial<AllocationPreview>): AllocationPreview => ({ feasible: false, occupiedStart: null, occupiedEnd: null, conflicts: [], hoursViolation: null, ...over })

  it("reports conflicts and hours violations as not feasible", () => {
    expect(previewView(preview({ conflicts: [conflict("x9")] }), null)).toMatchObject({ feasible: false })
    expect(previewView(preview({ hoursViolation: "outside_working_hours" }), null)).toMatchObject({ feasible: false, hoursViolation: "outside_working_hours" })
    expect(previewView(preview({ feasible: true }), null)).toMatchObject({ feasible: true, conflicts: [] })
  })

  it("does not let the allocation being edited conflict with itself", () => {
    const view = previewView(preview({ conflicts: [conflict("x1")] }), "x1")
    expect(view).toEqual({ feasible: true, conflicts: [], hoursViolation: null })
    expect(previewView(preview({ conflicts: [conflict("x1"), conflict("x2")] }), "x1").conflicts).toHaveLength(1)
  })
})
