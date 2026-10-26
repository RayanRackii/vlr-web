import { describe, expect, it } from "vitest"

import {
  bookingEndClock,
  displayEndClock,
  DEFAULT_TENANT_TIME_ZONE,
  clampTenantDateToToday,
  formatTenantDateTimeRange,
  formatTenantDayMonth,
  formatTenantTime,
  isTenantSlotStartInPast,
  tenantCivilDateTime,
  tenantCivilDaySpan,
  tenantCivilInstant,
  tenantTodayIsoDate,
} from "@/lib/tenantTimeZone"

describe("tenantTimeZone", () => {
  it("falls back to America/Sao_Paulo", () => {
    expect(DEFAULT_TENANT_TIME_ZONE).toBe("America/Sao_Paulo")
  })

  it("uses the tenant civil date in America/Manaus", () => {
    const instant = new Date("2026-09-10T03:30:00.000Z")

    expect(tenantTodayIsoDate("America/Manaus", instant)).toBe("2026-09-09")
    expect(formatTenantTime(instant, "America/Manaus", "en-GB")).toBe("23:30")
  })

  it("uses the tenant civil date and clock in Asia/Tokyo", () => {
    const instant = new Date("2026-09-10T16:00:00.000Z")

    expect(tenantTodayIsoDate("Asia/Tokyo", instant)).toBe("2026-09-11")
    expect(formatTenantTime(instant, "Asia/Tokyo", "en-GB")).toBe("01:00")
  })

  it("formats the New York DST jump without inventing a nonexistent local time", () => {
    const range = formatTenantDateTimeRange(
      "2026-03-08T06:30:00.000Z",
      "2026-03-08T07:30:00.000Z",
      "America/New_York",
      "en-GB",
    )

    expect(range).toContain("01:30")
    expect(range).toContain("03:30")
    expect(range).not.toContain("02:30")
  })

  it("compares slot starts on the requested tenant clock", () => {
    const now = new Date("2026-03-08T07:15:00.000Z")

    expect(
      isTenantSlotStartInPast(
        "2026-03-08",
        "03:00:00",
        "America/New_York",
        now,
      ),
    ).toBe(true)
    expect(
      isTenantSlotStartInPast(
        "2026-03-08",
        "03:30:00",
        "America/New_York",
        now,
      ),
    ).toBe(false)
  })

  it("clamps only complete civil dates before tenant today", () => {
    const now = new Date("2026-09-10T03:30:00.000Z")

    expect(clampTenantDateToToday("2026-09-08", "America/Manaus", now)).toBe(
      "2026-09-09",
    )
    expect(clampTenantDateToToday("2026-09-10", "America/Manaus", now)).toBe(
      "2026-09-10",
    )
    expect(clampTenantDateToToday("", "America/Manaus", now)).toBe("")
  })
})

describe("day-closing reservation ends", () => {
  it("shows 00:00 for legacy 23:59:59 and for next-day 00:00, without the next date", () => {
    // Sao Paulo is UTC-3: 23:30 local = 02:30Z next day
    expect(formatTenantDateTimeRange("2026-10-27T02:30:00Z", "2026-10-27T02:59:59Z", "America/Sao_Paulo", "pt-BR"))
      .toBe("26/10/2026 23:30 – 00:00")
    expect(formatTenantDateTimeRange("2026-10-27T02:30:00Z", "2026-10-27T03:00:00Z", "America/Sao_Paulo", "pt-BR"))
      .toBe("26/10/2026 23:30 – 00:00")
    expect(displayEndClock("23:59:59")).toBe("00:00")
    expect(displayEndClock("23:30:00")).toBe("23:30")
    expect(bookingEndClock("23:59:59")).toBe("23:59:59")
    expect(bookingEndClock("23:30:00")).toBe("23:30")
  })
})

describe("multi-day civil spans", () => {
  it("counts a same-day reservation as a single civil day", () => {
    expect(
      tenantCivilDaySpan(
        "2026-09-08T11:00:00.000Z",
        "2026-09-08T14:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe(1)
  })

  it("counts a 3-day reservation across civil days inclusively", () => {
    expect(
      tenantCivilDaySpan(
        "2026-09-08T11:00:00.000Z",
        "2026-09-10T14:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe(3)
  })

  it("keeps a 23:59:59 day-closing end on its inclusive civil date", () => {
    expect(
      tenantCivilDaySpan(
        "2026-09-08T11:00:00.000Z",
        "2026-09-09T02:59:59.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe(1)
  })

  it("treats an exact midnight end as exclusive", () => {
    expect(
      tenantCivilDaySpan(
        "2026-09-08T11:00:00.000Z",
        "2026-09-11T03:00:00.000Z",
        "America/Sao_Paulo",
      ),
    ).toBe(3)
  })

  it("formats a civil instant as dd/MM without a year", () => {
    expect(
      formatTenantDayMonth(
        new Date("2026-09-08T11:00:00.000Z"),
        "America/Sao_Paulo",
        "pt-BR",
      ),
    ).toBe("08/09")
  })

  it("converts a civil date and clock back to the matching UTC instant", () => {
    const instant = tenantCivilInstant("2026-09-08", "08:00", "America/Sao_Paulo")
    expect(instant.toISOString()).toBe("2026-09-08T11:00:00.000Z")
    expect(tenantTodayIsoDate("America/Sao_Paulo", instant)).toBe("2026-09-08")
  })

  it("round-trips a civil instant across a timezone ahead of UTC", () => {
    const instant = tenantCivilInstant("2026-09-11", "01:00", "Asia/Tokyo")
    expect(tenantCivilDateTime(instant, "Asia/Tokyo")).toEqual({
      date: "2026-09-11",
      time: "01:00:00",
    })
  })
})
