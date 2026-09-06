import { describe, expect, it } from "vitest"

import {
  brazilTodayIsoDate,
  formatBrazilDateTimeRange,
  formatBrazilTime,
  SAO_PAULO_TZ,
} from "@/lib/brazilTimeZone"

describe("brazilTimeZone", () => {
  it("exposes America/Sao_Paulo as the Rentals business clock", () => {
    expect(SAO_PAULO_TZ).toBe("America/Sao_Paulo")
  })

  it("renders a 13:00Z reservation instant as 10:00 in Sao Paulo", () => {
    const instant = new Date("2026-09-10T13:00:00.000Z")
    expect(formatBrazilTime(instant, "en-GB")).toBe("10:00")
    expect(formatBrazilDateTimeRange(
      "2026-09-10T13:00:00.000Z",
      "2026-09-10T14:00:00.000Z",
      "en-GB",
    )).toContain("10:00")
    expect(formatBrazilDateTimeRange(
      "2026-09-10T13:00:00.000Z",
      "2026-09-10T14:00:00.000Z",
      "en-GB",
    )).toContain("11:00")
  })

  it("renders a 01:00Z instant as 22:00 on the previous Brazil civil date", () => {
    expect(formatBrazilTime(new Date("2026-09-11T01:00:00.000Z"), "en-GB")).toBe(
      "22:00",
    )
  })

  it("uses Brazil civil today, not the UTC calendar date", () => {
    const utcMorning = new Date("2026-09-10T02:00:00.000Z")
    expect(brazilTodayIsoDate(utcMorning)).toBe("2026-09-09")

    const brazilMorning = new Date("2026-09-10T04:00:00.000Z")
    expect(brazilTodayIsoDate(brazilMorning)).toBe("2026-09-10")
  })
})
