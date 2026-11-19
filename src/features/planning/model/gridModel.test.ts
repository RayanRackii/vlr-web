import { describe, expect, it } from "vitest"
import type { PlanningAgenda, PlanningAgendaResource, PlanningAllocation } from "../schemas/planningSchemas"
import {
  agendaRange,
  assignLanes,
  blockTone,
  buildDayModel,
  buildWeekModel,
  closedSegments,
  dayWindow,
  effectiveWindow,
  minutesAtFraction,
  summarize,
  weekdayOf,
  workingSegments,
} from "./gridModel"

const ZONE = "America/Sao_Paulo" // UTC-3, no DST
const DAY = "2026-11-18" // a Wednesday

const resource = (over: Partial<PlanningAgendaResource> = {}): PlanningAgendaResource => ({
  assetId: "a1", name: "Impressora 3D", tag: "IMP-1", unitId: "u1", unitName: "Sede", capacity: 1,
  hoursPolicy: "Anytime", isRentalBacked: false, timeZoneId: ZONE, workingHours: [], ...over,
})

/** Instants given as local clock times in São Paulo. */
const at = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).toISOString()

const allocation = (over: Partial<PlanningAllocation> = {}): PlanningAllocation => ({
  id: "x1", assetId: "a1", assetName: "Impressora 3D", unitId: "u1", kind: "Use", title: "Peça A", notes: "", quantity: 1,
  plannedWorkStart: at(DAY, "10:00"), plannedWorkEnd: at(DAY, "12:00"), occupiedStart: at(DAY, "09:30"), occupiedEnd: at(DAY, "12:30"),
  timeZoneId: ZONE, status: "Scheduled", source: "Manual", referenceLabel: "", createdByUserId: null, cancelReason: "",
  actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, isBlocking: true, isExpired: false, isOverdue: false, version: "v1", ...over,
})

const agenda = (items: PlanningAllocation[], resources = [resource()], externalBusy: PlanningAgenda["externalBusy"] = []): PlanningAgenda => ({
  from: at(DAY, "00:00"), to: at("2026-11-19", "00:00"), resources, items, externalBusy,
})
const NOW = Date.parse(at(DAY, "11:00"))

describe("day positions", () => {
  it("places a block by its occupied window and splits prep, work and cleanup", () => {
    const [row] = buildDayModel(agenda([allocation()]), DAY, ZONE, NOW)
    const [block] = row.blocks
    expect(block.start).toBe(9 * 60 + 30)
    expect(block.end).toBe(12 * 60 + 30)
    expect(block.leftPct).toBeCloseTo((570 / 1440) * 100)
    expect(block.widthPct).toBeCloseTo((180 / 1440) * 100)
    expect(block.segments.prep).toBeCloseTo(30 / 180)
    expect(block.segments.work).toBeCloseTo(120 / 180)
    expect(block.segments.cleanup).toBeCloseTo(30 / 180)
    expect(block.continuesBefore).toBe(false)
    expect(block.continuesAfter).toBe(false)
  })

  it("clips an overnight job to the day and flags where it continues", () => {
    const night = allocation({ occupiedStart: at(DAY, "22:00"), occupiedEnd: at("2026-11-19", "06:00"), plannedWorkStart: at(DAY, "22:00"), plannedWorkEnd: at("2026-11-19", "06:00") })
    const [first] = buildDayModel(agenda([night]), DAY, ZONE, NOW)
    expect(first.blocks[0]).toMatchObject({ start: 22 * 60, end: 1440, continuesAfter: true, continuesBefore: false })
    const [second] = buildDayModel(agenda([night]), "2026-11-19", ZONE, NOW)
    expect(second.blocks[0]).toMatchObject({ start: 0, end: 6 * 60, continuesBefore: true, continuesAfter: false })
  })

  it("drops blocks on other days, other assets and cancelled rows", () => {
    const items = [
      allocation({ id: "other-day", occupiedStart: at("2026-11-20", "09:00"), occupiedEnd: at("2026-11-20", "10:00") }),
      allocation({ id: "other-asset", assetId: "a2" }),
      allocation({ id: "gone", status: "Cancelled" }),
    ]
    expect(buildDayModel(agenda(items), DAY, ZONE, NOW)[0].blocks).toEqual([])
  })

  it("keeps a started job past its end alive until now, and flags it overdue", () => {
    const running = allocation({ status: "Running", isOverdue: true, actualStartAt: at(DAY, "10:00"), plannedWorkEnd: at(DAY, "10:30"), occupiedEnd: at(DAY, "10:30"), occupiedStart: at(DAY, "10:00") })
    const [block] = buildDayModel(agenda([running]), DAY, ZONE, NOW)[0].blocks
    expect(block.end).toBe(1440)
    expect(block.continuesAfter).toBe(true)
    expect(block.overdue).toBe(true)
    expect(block.tone).toBe("running")
    expect(effectiveWindow(running, NOW, Date.parse(agenda([]).to)).end).toBe(agenda([]).to)
  })

  it("shows the asset busy on a future day while a started job is unreleased", () => {
    const running = allocation({ status: "Running", isOverdue: true, actualStartAt: at(DAY, "10:00"), occupiedStart: at(DAY, "10:00"), occupiedEnd: at(DAY, "10:30"), plannedWorkEnd: at(DAY, "10:30") })
    const week = { ...agenda([running]), to: at("2026-11-23", "00:00") }
    const model = buildWeekModel(week, "2026-11-16", ZONE, NOW)
    const cells = model.rows[0].cells
    expect(cells[4].busyMinutes).toBe(1440)
    expect(cells[6].blocks[0].overdue).toBe(true)
    expect(cells[1].blocks).toEqual([])
  })

  it("starts a job that began early at its real start", () => {
    const early = allocation({ status: "Running", actualStartAt: at(DAY, "09:00") })
    expect(effectiveWindow(early, NOW, NOW).start).toBe(at(DAY, "09:00"))
  })

  it("marks an expired scheduled row without changing its position", () => {
    const [block] = buildDayModel(agenda([allocation({ isExpired: true, isBlocking: false })]), DAY, ZONE, NOW)[0].blocks
    expect(block.expired).toBe(true)
    expect(block.start).toBe(570)
  })

  it("maps tones", () => {
    expect(blockTone({ kind: "Unavailable", status: "Scheduled" })).toBe("unavailable")
    expect(blockTone({ kind: "Use", status: "Cleaning" })).toBe("cleaning")
    expect(blockTone({ kind: "Use", status: "Released" })).toBe("released")
    expect(blockTone({ kind: "Use", status: "Scheduled" })).toBe("scheduled")
  })

  it("shows anonymous customer reservations as external busy spans", () => {
    const [row] = buildDayModel(agenda([], [resource({ isRentalBacked: true })], [
      { assetId: "a1", start: at(DAY, "14:00"), end: at(DAY, "15:00") },
      { assetId: "a1", start: at(DAY, "14:30"), end: at(DAY, "16:00") },
      { assetId: "a2", start: at(DAY, "08:00"), end: at(DAY, "09:00") },
    ]), DAY, ZONE, NOW)
    expect(row.external).toEqual([{ start: 14 * 60, end: 16 * 60 }])
  })
})

describe("overlaps", () => {
  it("stacks overlapping blocks in lanes and reuses a lane when one ends first", () => {
    const blocks = [
      { start: 60, end: 180, lane: 0 },
      { start: 120, end: 240, lane: 0 },
      { start: 180, end: 300, lane: 0 },
    ]
    expect(assignLanes(blocks)).toBe(2)
    expect(blocks.map((b) => b.lane)).toEqual([0, 1, 0])
  })

  it("reports one lane for an empty row", () => {
    expect(assignLanes([])).toBe(1)
  })

  it("treats touching blocks as not overlapping", () => {
    const blocks = [{ start: 0, end: 60, lane: 0 }, { start: 60, end: 120, lane: 0 }]
    expect(assignLanes(blocks)).toBe(1)
  })

  it("exposes the lane count on the row", () => {
    const items = [allocation({ id: "a" }), allocation({ id: "b", occupiedStart: at(DAY, "11:00"), occupiedEnd: at(DAY, "13:00") })]
    const [row] = buildDayModel(agenda(items), DAY, ZONE, NOW)
    expect(row.laneCount).toBe(2)
  })
})

describe("working hours shading", () => {
  const hours = [{ dayOfWeek: 3, openTime: "08:00:00", closeTime: "12:00:00" }, { dayOfWeek: 3, openTime: "13:00:00", closeTime: "18:00:00" }]

  it("reads the civil weekday like the API (0 = Sunday)", () => {
    expect(weekdayOf(DAY)).toBe(3)
    expect(weekdayOf("2026-11-22")).toBe(0)
  })

  it("shades the complement of the windows, including the lunch break", () => {
    const closed = closedSegments(resource({ hoursPolicy: "StartWithinHours", workingHours: hours }), DAY)
    expect(closed).toEqual([{ start: 0, end: 480 }, { start: 720, end: 780 }, { start: 1080, end: 1440 }])
  })

  it("does not shade a round-the-clock asset", () => {
    expect(closedSegments(resource({ hoursPolicy: "Anytime", workingHours: hours }), DAY)).toEqual([])
    expect(workingSegments(resource({ hoursPolicy: "Anytime" }), DAY)).toBeNull()
  })

  it("shades the whole day when the asset has no window that weekday", () => {
    expect(closedSegments(resource({ hoursPolicy: "WithinHours", workingHours: hours }), "2026-11-19")).toEqual([{ start: 0, end: 1440 }])
  })

  it("skips a window whose close is not after its open, like the API (close 00:00)", () => {
    const night = [{ dayOfWeek: 3, openTime: "18:00:00", closeTime: "00:00:00" }]
    expect(workingSegments(resource({ hoursPolicy: "WithinHours", workingHours: night }), DAY)).toEqual([])
    expect(closedSegments(resource({ hoursPolicy: "WithinHours", workingHours: night }), DAY)).toEqual([{ start: 0, end: 1440 }])
  })

  it("reads a close of 23:59 or later as the end of the day", () => {
    const late = [{ dayOfWeek: 3, openTime: "18:00:00", closeTime: "23:59:00" }]
    expect(workingSegments(resource({ hoursPolicy: "WithinHours", workingHours: late }), DAY)).toEqual([{ start: 1080, end: 1440 }])
  })

  it("keeps a normal window as it is", () => {
    const normal = [{ dayOfWeek: 3, openTime: "08:00:00", closeTime: "17:30:00" }]
    expect(workingSegments(resource({ hoursPolicy: "WithinHours", workingHours: normal }), DAY)).toEqual([{ start: 480, end: 1050 }])
  })

  it("puts the shading on the row", () => {
    const [row] = buildDayModel(agenda([], [resource({ hoursPolicy: "StartWithinHours", workingHours: hours })]), DAY, ZONE, NOW)
    expect(row.closed).toHaveLength(3)
  })
})

describe("week model", () => {
  it("builds seven days from the Monday and counts busy time per cell without double counting", () => {
    const items = [
      allocation({ id: "a", occupiedStart: at(DAY, "09:00"), occupiedEnd: at(DAY, "11:00") }),
      allocation({ id: "b", occupiedStart: at(DAY, "10:00"), occupiedEnd: at(DAY, "12:00") }),
    ]
    const week = buildWeekModel(agenda(items), "2026-11-16", ZONE, NOW)
    expect(week.days).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"])
    const wednesday = week.rows[0].cells[2]
    expect(wednesday.blocks).toHaveLength(2)
    expect(wednesday.busyMinutes).toBe(180)
    expect(week.rows[0].cells[0].blocks).toEqual([])
  })

  it("lists an overnight job on both days and marks closed days", () => {
    const night = allocation({ occupiedStart: at(DAY, "22:00"), occupiedEnd: at("2026-11-19", "02:00"), plannedWorkStart: at(DAY, "22:00"), plannedWorkEnd: at("2026-11-19", "02:00") })
    const hours = [{ dayOfWeek: 1, openTime: "08:00", closeTime: "18:00" }]
    const week = buildWeekModel(agenda([night], [resource({ hoursPolicy: "StartWithinHours", workingHours: hours })]), "2026-11-16", ZONE, NOW)
    expect(week.rows[0].cells[2].blocks).toHaveLength(1)
    expect(week.rows[0].cells[3].blocks).toHaveLength(1)
    expect(week.rows[0].cells.map((cell) => cell.closedAllDay)).toEqual([false, true, true, true, true, true, true])
  })
})

describe("helpers", () => {
  it("clips a window to a day in a zone", () => {
    expect(dayWindow(at(DAY, "23:00"), at("2026-11-19", "01:00"), DAY, ZONE)).toEqual({ start: 1380, end: 1440 })
    expect(dayWindow(at(DAY, "10:00"), at(DAY, "10:00"), DAY, ZONE)).toBeNull()
  })

  it("converts the civil range to instants of the tenant zone", () => {
    expect(agendaRange("2026-11-18", "2026-11-18", ZONE)).toEqual({ from: "2026-11-18T03:00:00.000Z", to: "2026-11-19T03:00:00.000Z" })
    expect(agendaRange("2026-11-16", "2026-11-22", ZONE).to).toBe("2026-11-23T03:00:00.000Z")
  })

  it("snaps a click position to half hours inside the day", () => {
    expect(minutesAtFraction(0.5)).toBe(720)
    expect(minutesAtFraction(0.5 + 10 / 1440)).toBe(720)
    expect(minutesAtFraction(1)).toBe(1410)
    expect(minutesAtFraction(-1)).toBe(0)
  })

  it("summarizes the agenda", () => {
    const items = [allocation({ id: "1", isOverdue: true }), allocation({ id: "2", isExpired: true }), allocation({ id: "3", status: "Cancelled" })]
    expect(summarize(agenda(items))).toEqual({ resources: 1, allocations: 2, overdue: 1, expired: 1 })
  })
})
