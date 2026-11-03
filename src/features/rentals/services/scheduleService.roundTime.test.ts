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

  it("keeps a rounded value within the same day and never returns NaN", () => {
    expect(roundScheduleTimeToMinute("23:59:40")).toBe("23:59")
    expect(roundScheduleTimeToMinute("garbage")).toBe("garba")
    expect(roundScheduleTimeToMinute("")).toBe("")
  })

  it("is used by formatScheduleTime for display", () => {
    expect(formatScheduleTime("06:38:31.9")).toBe("06:39")
  })
})
