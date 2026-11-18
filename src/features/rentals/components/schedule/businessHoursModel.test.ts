import { describe, expect, it } from "vitest"

import {
  buildBusinessHoursPlan,
  deriveBusinessHours,
  draftProblem,
  isDraftDirty,
  summarizeRemovals,
  type BusinessHoursDraft,
} from "./businessHoursModel"
import type {
  AdminRentalAsset,
  DayOfWeekName,
  ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"

function asset(id: string, extra: Partial<AdminRentalAsset> = {}): AdminRentalAsset {
  return {
    id, assetId: `a-${id}`, name: `Sala ${id}`, isActive: true, requiresDeposit: false,
    unitId: "unit", type: "Location", totalQuantity: 1, schedulePolicy: "SlotGrid", queueEnabled: false,
    ...extra,
  } as AdminRentalAsset
}

let counter = 0
function template(rentalAssetId: string, dayOfWeek: DayOfWeekName, startTime: string, endTime: string): ScheduleTemplate {
  counter += 1
  return {
    id: `t-${counter}`, rentalAssetId, assetName: rentalAssetId, dayOfWeek, startTime, endTime,
    occupancyKindId: "open", occupancyKindLabel: "Aberto", label: null, isActive: true,
  }
}

function hourly(rentalAssetId: string, day: DayOfWeekName, from: number, to: number) {
  return Array.from({ length: to - from }, (_, index) =>
    template(rentalAssetId, day, `${String(from + index).padStart(2, "0")}:00:00`, `${String(from + index + 1).padStart(2, "0")}:00:00`),
  )
}

function open(draft: BusinessHoursDraft, day: DayOfWeekName, openTime: string, closeTime: string): BusinessHoursDraft {
  return { ...draft, days: { ...draft.days, [day]: { ...draft.days[day], open: true, openTime, closeTime, touched: true } } }
}

describe("deriveBusinessHours", () => {
  it("reads the earliest start and latest end of each weekday and the slot length", () => {
    const templates = [...hourly("a", "Monday", 8, 12), ...hourly("a", "Monday", 14, 18)]
    const draft = deriveBusinessHours([asset("a")], templates)
    expect(draft.days.Monday).toMatchObject({ open: true, openTime: "08:00", closeTime: "18:00", mixed: false })
    expect(draft.days.Tuesday.open).toBe(false)
    expect(draft.slotMinutes).toBe(60)
    expect(isDraftDirty(draft)).toBe(false)
  })

  it("marks a weekday as mixed and leaves it empty when resources differ", () => {
    const templates = [...hourly("a", "Monday", 8, 18), ...hourly("b", "Monday", 9, 18)]
    const draft = deriveBusinessHours([asset("a"), asset("b")], templates)
    expect(draft.days.Monday).toMatchObject({ mixed: true, open: false, openTime: "", closeTime: "" })
  })

  it("treats a resource that is closed on a weekday as different from one that is open", () => {
    const draft = deriveBusinessHours([asset("a"), asset("b")], hourly("a", "Friday", 8, 12))
    expect(draft.days.Friday.mixed).toBe(true)
    expect(draft.days.Monday).toMatchObject({ mixed: false, open: false })
  })

  it("uses the resource open and close times for open-hours resources", () => {
    const draft = deriveBusinessHours([asset("a", { schedulePolicy: "OpenHours", openTime: "07:00:00", closeTime: "21:00:00" })], [])
    expect(draft.days.Sunday).toMatchObject({ open: true, openTime: "07:00", closeTime: "21:00" })
  })

  it("requires a choice when the slot length differs between resources", () => {
    const half = [template("a", "Monday", "08:00:00", "08:30:00")]
    const draft = deriveBusinessHours([asset("a"), asset("b")], [...half, ...hourly("b", "Monday", 8, 10)])
    expect(draft.slotMixed).toBe(true)
    expect(draft.slotMinutes).toBeNull()
  })
})

describe("buildBusinessHoursPlan", () => {
  const assets = [asset("a"), asset("b")]

  it("groups weekdays with identical hours into one weekly-rule call", () => {
    let draft = deriveBusinessHours(assets, [])
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const) draft = open(draft, day, "08:00", "22:00")
    draft = open(draft, "Saturday", "08:00", "14:00")
    const plan = buildBusinessHoursPlan(draft, ["a", "b"], [], "open")
    expect(plan.groups).toEqual([
      { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], openTime: "08:00", closeTime: "22:00" },
      { days: ["Saturday"], openTime: "08:00", closeTime: "14:00" },
    ])
    expect(plan.removals).toEqual([])
    expect(plan.policyHours).toEqual({ openTime: "08:00", closeTime: "22:00" })
  })

  it("removes the templates of a weekday that was switched off, for the selected resources only", () => {
    const templates = [...hourly("a", "Sunday", 8, 10), ...hourly("b", "Sunday", 8, 10), ...hourly("c", "Sunday", 8, 10)]
    const base = deriveBusinessHours(assets, templates)
    const draft: BusinessHoursDraft = { ...base, days: { ...base.days, Sunday: { ...base.days.Sunday, open: false, touched: true } } }
    const plan = buildBusinessHoursPlan(draft, ["a", "b"], templates, "open")
    expect(plan.groups).toEqual([])
    expect(plan.removals).toHaveLength(4)
    expect(plan.removals.every((item) => item.reason === "closed" && item.template.rentalAssetId !== "c")).toBe(true)
    expect(summarizeRemovals(plan.removals)).toEqual([{ day: "Sunday", reason: "closed", count: 4, resources: 2 }])
  })

  it("removes slots that fall outside narrower hours", () => {
    const templates = hourly("a", "Monday", 8, 22)
    const draft = open(deriveBusinessHours([asset("a")], templates), "Monday", "09:00", "20:00")
    const plan = buildBusinessHoursPlan(draft, ["a"], templates, "open")
    expect(plan.removals.map((item) => `${item.template.startTime}`)).toEqual(["08:00:00", "20:00:00", "21:00:00"])
    expect(plan.removals.every((item) => item.reason === "outside")).toBe(true)
  })

  it("skips weekdays that differ between resources until the user edits them", () => {
    const templates = [...hourly("a", "Monday", 8, 18), ...hourly("b", "Monday", 9, 18)]
    const base = deriveBusinessHours(assets, templates)
    const untouched = buildBusinessHoursPlan(base, ["a", "b"], templates, "open")
    expect(untouched.groups).toEqual([])
    expect(untouched.removals).toEqual([])
    const edited = buildBusinessHoursPlan(open(base, "Monday", "08:00", "18:00"), ["a", "b"], templates, "open")
    expect(edited.groups).toEqual([{ days: ["Monday"], openTime: "08:00", closeTime: "18:00" }])
  })

  it("re-applies open weekdays when only the slot length changed", () => {
    const templates = hourly("a", "Monday", 8, 12)
    const base = deriveBusinessHours([asset("a")], templates)
    const plan = buildBusinessHoursPlan({ ...base, slotMinutes: 30, slotTouched: true }, ["a"], templates, "open")
    expect(plan.groups).toEqual([{ days: ["Monday"], openTime: "08:00", closeTime: "12:00" }])
    expect(plan.slotMinutes).toBe(30)
  })

  it("replaces the old grid when the slot length changes: deletes first, one apply", () => {
    const templates = hourly("a", "Monday", 8, 12)
    const base = deriveBusinessHours([asset("a")], templates)
    const plan = buildBusinessHoursPlan({ ...base, slotMinutes: 30, slotTouched: true }, ["a"], templates, "open")
    expect(plan.groups).toHaveLength(1)
    expect(plan.removals).toHaveLength(4)
    expect(plan.removals.every((item) => item.reason === "replace")).toBe(true)
    expect(summarizeRemovals(plan.removals)).toEqual([{ day: "Monday", reason: "replace", count: 4, resources: 1 }])
  })

  it("replaces slots that no longer sit on the grid when the open time moves", () => {
    const templates = hourly("a", "Monday", 8, 12)
    const draft = open(deriveBusinessHours([asset("a")], templates), "Monday", "08:30", "12:00")
    const plan = buildBusinessHoursPlan(draft, ["a"], templates, "open")
    expect(plan.removals.map((item) => item.template.startTime)).toEqual(["08:00:00", "09:00:00", "10:00:00", "11:00:00"])
    expect(plan.removals.every((item) => item.reason === "replace")).toBe(true)
  })

  it("deletes nothing when the new grid matches the existing slots exactly", () => {
    const templates = hourly("a", "Monday", 8, 12)
    const base = deriveBusinessHours([asset("a")], templates)
    const plan = buildBusinessHoursPlan({ ...base, slotTouched: true }, ["a"], templates, "open")
    expect(plan.groups).toHaveLength(1)
    expect(plan.removals).toEqual([])
  })

  it("skips a day where templates of another kind overlap and reports it", () => {
    const templates = [...hourly("a", "Monday", 8, 10), { ...hourly("a", "Monday", 10, 11)[0], occupancyKindId: "lesson" }]
    const draft = open(deriveBusinessHours([asset("a")], templates), "Monday", "08:00", "12:00")
    const plan = buildBusinessHoursPlan(draft, ["a"], templates, "open")
    expect(plan.conflicts).toEqual(["Monday"])
    expect(plan.groups).toEqual([])
    expect(plan.removals).toEqual([])
  })
})

describe("draftProblem", () => {
  it("rejects incomplete or reversed hours and a missing slot length", () => {
    const base = deriveBusinessHours([asset("a")], [])
    expect(draftProblem(base)).toBeNull()
    expect(draftProblem(open(base, "Monday", "18:00", "08:00"))).toBe("invalidTimes")
    expect(draftProblem(open(base, "Monday", "08:", "18:00"))).toBe("invalidTimes")
    expect(draftProblem({ ...open(base, "Monday", "08:00", "18:00"), slotMinutes: null })).toBe("slotRequired")
    expect(draftProblem({ ...open(base, "Monday", "08:00", "18:00"), slotMinutes: 0 })).toBe("invalidSlot")
    expect(draftProblem(open(base, "Monday", "08:00", "18:00"))).toBeNull()
  })
})
