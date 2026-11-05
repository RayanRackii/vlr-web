import { describe, expect, it } from "vitest"

import { formatScheduleTime, roundScheduleTimeToMinute } from "./scheduleService"

describe("roundScheduleTimeToMinute", () => {
  it("rounds fractional-second end times to the nearest minute", () => {
    expect(roundScheduleTimeToMinute("06:38:26.4433560")).toBe("06:38")
    expect(roundScheduleTimeToMinute("06:38:31")).toBe("06:39")
    expect(roundScheduleTimeToMinute("06:38:30")).toBe("06:39")
  })

  it("normalizes already-minute values without seconds", () => {
    expect(roundScheduleTimeToMinute("08:00")).toBe("08:00")
    expect(roundScheduleTimeToMinute("08:00:00")).toBe("08:00")
    expect(roundScheduleTimeToMinute("8:05")).toBe("08:05")
  })

  it("rounds up to 24:00 without clamping and never returns NaN", () => {
    expect(roundScheduleTimeToMinute("23:59:40")).toBe("24:00")
    expect(roundScheduleTimeToMinute("24:00")).toBe("24:00")
    expect(roundScheduleTimeToMinute("24:00:00")).toBe("24:00")
    expect(roundScheduleTimeToMinute("garbage")).toBe("garba")
    expect(roundScheduleTimeToMinute("")).toBe("")
  })

  it("leaves formatScheduleTime unchanged (no rounding outside the agenda screens)", () => {
    expect(formatScheduleTime("06:38:31.9")).toBe("06:38")
    expect(formatScheduleTime("24:00:00")).toBe("24:00")
  })
})
