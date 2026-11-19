import { describe, expect, it } from "vitest"
import type { AssetProfile } from "../schemas/planningSchemas"
import {
  WORK_WEEK,
  addWindow,
  closeMinutes,
  countWindows,
  copyToWeekdays,
  draftFromProfile,
  newWindow,
  parseBuffer,
  removeWindow,
  setDayOpen,
  toRequest,
  updateWindow,
  validateDraft,
  type AvailabilityDraft,
} from "./availabilityForm"

const profile = (over: Partial<AssetProfile> = {}): AssetProfile => ({
  assetId: "a1", isConfigured: true, isPlannable: true, isRentalBacked: false, capacity: 1,
  hoursPolicy: "StartWithinHours", defaultPrepMinutes: 10, defaultCleanupMinutes: 5, workingHours: [], ...over,
})

function draftWith(hours: Partial<Record<number, [string, string][]>>, over: Partial<AvailabilityDraft> = {}): AvailabilityDraft {
  const base = draftFromProfile(profile())
  for (const [day, windows] of Object.entries(hours)) {
    base.days[Number(day) as 0] = { windows: (windows ?? []).map(([open, close]) => newWindow(open, close)) }
  }
  return { ...base, ...over }
}

describe("draftFromProfile", () => {
  it("groups windows by day, trims seconds and orders them by opening time", () => {
    const draft = draftFromProfile(profile({
      workingHours: [
        { dayOfWeek: 1, openTime: "14:00:00", closeTime: "18:00:00" },
        { dayOfWeek: 1, openTime: "08:00:00", closeTime: "12:00:00" },
        { dayOfWeek: 0, openTime: "09:00", closeTime: "23:59" },
      ],
    }))
    expect(draft.days[1].windows.map((w) => [w.openTime, w.closeTime])).toEqual([["08:00", "12:00"], ["14:00", "18:00"]])
    expect(draft.days[0].windows).toHaveLength(1)
    expect(draft.days[2].windows).toHaveLength(0)
    expect(draft.prepMinutes).toBe("10")
  })

  it("starts a never-configured asset on StartWithinHours, plannable off", () => {
    const draft = draftFromProfile(profile({ isConfigured: false, isPlannable: false, hoursPolicy: "" }))
    expect(draft.hoursPolicy).toBe("StartWithinHours")
    expect(draft.isPlannable).toBe(false)
  })

  it("keeps a saved policy", () => {
    expect(draftFromProfile(profile({ hoursPolicy: "WithinHours" })).hoursPolicy).toBe("WithinHours")
    expect(draftFromProfile(profile({ hoursPolicy: "Anytime" })).hoursPolicy).toBe("Anytime")
  })
})

describe("close time rule", () => {
  it("reads 23:59 as midnight, like the API", () => {
    expect(closeMinutes("23:59")).toBe(24 * 60)
    expect(closeMinutes("23:58")).toBe(23 * 60 + 58)
    expect(closeMinutes("nope")).toBeNull()
  })

  it("rejects open 23:59 with close 23:59 (raw times, like the API) but accepts 23:30 to 23:59", () => {
    expect(Object.values(validateDraft(draftWith({ 1: [["23:59", "23:59"]] })).windows)).toEqual(["closeBeforeOpen"])
    expect(validateDraft(draftWith({ 1: [["23:30", "23:59"]] })).valid).toBe(true)
  })

  it("accepts a window that closes at 23:59 and rejects close <= open (including 00:00)", () => {
    expect(validateDraft(draftWith({ 1: [["08:00", "23:59"]] })).valid).toBe(true)
    const validation = validateDraft(draftWith({ 1: [["08:00", "00:00"], ["09:00", "09:00"], ["10:00", "09:00"]] }))
    expect(Object.values(validation.windows)).toEqual(["closeBeforeOpen", "closeBeforeOpen", "closeBeforeOpen"])
    expect(validation.valid).toBe(false)
  })

  it("rejects text that is not HH:mm", () => {
    const validation = validateDraft(draftWith({ 1: [["8h", "18:00"]] }))
    expect(Object.values(validation.windows)).toEqual(["invalidTime"])
  })
})

describe("overlaps", () => {
  it("flags both windows of an overlap on the same day", () => {
    const draft = draftWith({ 2: [["08:00", "12:00"], ["11:00", "15:00"]] })
    const validation = validateDraft(draft)
    expect(Object.values(validation.windows)).toEqual(["overlap", "overlap"])
    expect(validation.valid).toBe(false)
  })

  it("allows windows that only touch, or that sit on different days", () => {
    expect(validateDraft(draftWith({ 2: [["08:00", "12:00"], ["12:00", "15:00"]] })).valid).toBe(true)
    expect(validateDraft(draftWith({ 2: [["08:00", "12:00"]], 3: [["08:00", "12:00"]] })).valid).toBe(true)
  })

  it("treats a window that runs to midnight as overlapping a later evening window", () => {
    const validation = validateDraft(draftWith({ 5: [["18:00", "23:59"], ["20:00", "21:00"]] }))
    expect(validation.valid).toBe(false)
  })
})

describe("draft level rules", () => {
  it("requires hours for a plannable asset whose policy is not Anytime", () => {
    expect(validateDraft(draftWith({})).draft).toContain("hoursRequired")
    expect(validateDraft(draftWith({}, { hoursPolicy: "WithinHours" })).valid).toBe(false)
  })

  it("needs no hours under Anytime, or while the asset is not plannable", () => {
    expect(validateDraft(draftWith({}, { hoursPolicy: "Anytime" })).valid).toBe(true)
    expect(validateDraft(draftWith({}, { isPlannable: false })).valid).toBe(true)
  })

  it("still reports a broken stored window under Anytime or while not plannable, instead of dropping it", () => {
    expect(validateDraft(draftWith({ 1: [["10:00", "09:00"]] }, { hoursPolicy: "Anytime" })).valid).toBe(false)
    expect(validateDraft(draftWith({ 1: [["10:00", "09:00"]] }, { isPlannable: false })).valid).toBe(false)
  })

  it("caps the windows at 100, like the API", () => {
    const days = [1, 2, 3, 4, 5, 6, 0]
    const hours: Partial<Record<number, [string, string][]>> = {}
    // 100 non-overlapping windows spread over the week (15 per day, 10 on the last)
    let left = 100
    for (const day of days) {
      const n = Math.min(15, left)
      hours[day] = Array.from({ length: n }, (_, i) => [String(i + 6).padStart(2, "0") + ":00", String(i + 6).padStart(2, "0") + ":30"] as [string, string])
      left -= n
    }
    const full = draftWith(hours)
    expect(countWindows(full)).toBe(100)
    expect(validateDraft(full).valid).toBe(true)
    expect(addWindow(full, 1)).toBe(full)
    expect(setDayOpen(full, 0, false).days[0].windows).toHaveLength(0)
    const over = { ...full, days: { ...full.days, 0: { windows: [...full.days[0].windows, newWindow("20:00", "21:00")] } } }
    expect(validateDraft(over).draft).toContain("tooManyWindows")
    // a copy that would pass the cap is refused
    const wide = draftWith({ 6: Array.from({ length: 30 }, (_, i) => [String(i % 20).padStart(2, "0") + ":00", String(i % 20).padStart(2, "0") + ":30"] as [string, string]) })
    expect(copyToWeekdays(wide, 6)).toBe(wide)
  })

  it("accepts whole minutes from 0 to 1440 for prep and cleanup", () => {
    expect(parseBuffer("0")).toBe(0)
    expect(parseBuffer("1440")).toBe(1440)
    expect(parseBuffer("1441")).toBeNull()
    expect(parseBuffer("-5")).toBeNull()
    expect(parseBuffer("1.5")).toBeNull()
    expect(parseBuffer("")).toBeNull()
    expect(validateDraft(draftWith({ 1: [["08:00", "18:00"]] }, { prepMinutes: "abc" })).draft).toContain("invalidBuffer")
  })
})

describe("editing helpers", () => {
  it("copies a day's windows onto Monday to Friday, with new ids, and leaves the weekend alone", () => {
    const draft = draftWith({ 3: [["08:00", "12:00"], ["13:00", "18:00"]], 1: [["06:00", "07:00"]], 6: [["09:00", "10:00"]] })
    const copied = copyToWeekdays(draft, 3)
    for (const day of WORK_WEEK) {
      expect(copied.days[day].windows.map((w) => [w.openTime, w.closeTime])).toEqual([["08:00", "12:00"], ["13:00", "18:00"]])
    }
    expect(copied.days[6].windows.map((w) => w.openTime)).toEqual(["09:00"])
    expect(copied.days[0].windows).toHaveLength(0)
    const ids = WORK_WEEK.flatMap((day) => copied.days[day].windows.map((w) => w.id))
    expect(new Set(ids).size).toBe(ids.length)
    // the source draft is untouched
    expect(draft.days[1].windows.map((w) => w.openTime)).toEqual(["06:00"])
  })

  it("copying a closed day closes the weekdays", () => {
    const draft = draftWith({ 1: [["08:00", "18:00"]] })
    const copied = copyToWeekdays(draft, 2)
    expect(copied.days[1].windows).toHaveLength(0)
  })

  it("opens a day with one default window and closes it by removing every window", () => {
    const opened = setDayOpen(draftWith({}), 4, true)
    expect(opened.days[4].windows.map((w) => [w.openTime, w.closeTime])).toEqual([["08:00", "18:00"]])
    expect(setDayOpen(opened, 4, false).days[4].windows).toEqual([])
  })

  it("adds a second window after the previous one without overlapping it", () => {
    const draft = addWindow(draftWith({ 1: [["08:00", "12:00"]] }), 1)
    expect(draft.days[1].windows).toHaveLength(2)
    expect(validateDraft(draft).valid).toBe(true)
  })

  it("updates and removes a window by id", () => {
    const draft = draftWith({ 1: [["08:00", "12:00"], ["13:00", "18:00"]] })
    const [first, second] = draft.days[1].windows
    const updated = updateWindow(draft, 1, first.id, { closeTime: "11:00" })
    expect(updated.days[1].windows[0].closeTime).toBe("11:00")
    expect(removeWindow(updated, 1, second.id).days[1].windows).toHaveLength(1)
  })
})

describe("request payload", () => {
  it("builds the PUT body: day 0 is Sunday, times are HH:mm, windows sorted", () => {
    const draft = draftWith({ 0: [["09:00", "23:59"]], 1: [["13:00", "18:00"], ["08:00", "12:00"]] }, { prepMinutes: "15", cleanupMinutes: "30" })
    expect(toRequest(draft)).toEqual({
      isPlannable: true,
      capacity: 1,
      hoursPolicy: "StartWithinHours",
      defaultPrepMinutes: 15,
      defaultCleanupMinutes: 30,
      workingHours: [
        { dayOfWeek: 0, openTime: "09:00", closeTime: "23:59" },
        { dayOfWeek: 1, openTime: "08:00", closeTime: "12:00" },
        { dayOfWeek: 1, openTime: "13:00", closeTime: "18:00" },
      ],
    })
  })

  it("keeps the windows under Anytime and while not plannable", () => {
    const hours = { 1: [["08:00", "18:00"]] as [string, string][] }
    expect(toRequest(draftWith(hours, { hoursPolicy: "Anytime" })).workingHours).toEqual([{ dayOfWeek: 1, openTime: "08:00", closeTime: "18:00" }])
    expect(toRequest(draftWith(hours, { isPlannable: false })).workingHours).toEqual([{ dayOfWeek: 1, openTime: "08:00", closeTime: "18:00" }])
  })

  it("sends an empty list only when every day was cleared", () => {
    const cleared = setDayOpen(draftWith({ 1: [["08:00", "18:00"]] }), 1, false)
    expect(toRequest(cleared).workingHours).toEqual([])
  })

  it("keeps the asset's capacity", () => {
    expect(toRequest(draftFromProfile(profile({ capacity: 3 }))).capacity).toBe(3)
  })
})
