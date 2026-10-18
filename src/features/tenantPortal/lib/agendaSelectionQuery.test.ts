import { describe, expect, it } from "vitest"

import {
  agendaSelectionSearchParams,
  classifyAgendaDateAttempt,
  readAgendaDateParam,
  readAgendaTimeParam,
} from "@/features/tenantPortal/lib/agendaSelectionQuery"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"

const TODAY = brazilTodayIsoDate()

describe("agenda selection query", () => {
  it("falls back to today and no time when the params are missing or invalid", () => {
    expect(readAgendaDateParam(null, TODAY)).toBe(TODAY)
    expect(readAgendaDateParam("yesterday", TODAY)).toBe(TODAY)
    expect(readAgendaDateParam("2020-01-01", TODAY)).toBe(TODAY)
    expect(readAgendaDateParam("2026-11-31", TODAY)).toBe(TODAY)
    expect(readAgendaDateParam("2026-02-31", TODAY)).toBe(TODAY)
    expect(readAgendaTimeParam(null)).toBeNull()
    expect(readAgendaTimeParam("15")).toBeNull()
    expect(readAgendaTimeParam("99:00")).toBeNull()
  })

  it("reads a future date and a clock with or without seconds", () => {
    expect(readAgendaDateParam("2026-10-20", TODAY)).toBe("2026-10-20")
    expect(readAgendaTimeParam("13:00")).toBe("13:00")
    expect(readAgendaTimeParam("13:00:00")).toBe("13:00")
  })

  it("writes the chosen time and keeps reservation while omitting today", () => {
    const current = new URLSearchParams("reservation=abc&date=2026-10-01")
    const next = agendaSelectionSearchParams(current, TODAY, "15:00", TODAY)

    expect(next.get("reservation")).toBe("abc")
    expect(next.get("date")).toBeNull()
    expect(next.get("time")).toBe("15:00")

    const later = agendaSelectionSearchParams(next, "2099-01-15", "13:00:00", TODAY)
    expect(later.get("reservation")).toBe("abc")
    expect(later.get("date")).toBe("2099-01-15")
    expect(later.get("time")).toBe("13:00")
  })

  it("keeps an empty or impossible day from replacing the selection", () => {
    expect(classifyAgendaDateAttempt("", TODAY, "2026-10-16").status).toBe("empty")
    expect(classifyAgendaDateAttempt("2026-11-31", TODAY, "2026-10-16").status).toBe(
      "invalid",
    )
    expect(classifyAgendaDateAttempt("2020-01-01", TODAY, "2026-10-16").status).toBe(
      "before",
    )
    expect(classifyAgendaDateAttempt("2099-12-31", TODAY, "2026-10-16").status).toBe(
      "after",
    )
    expect(classifyAgendaDateAttempt("2099-06-01", TODAY, "2099-12-31")).toEqual({
      status: "ok",
      date: "2099-06-01",
    })
    expect(classifyAgendaDateAttempt("2099-12-31", TODAY, null)).toEqual({
      status: "ok",
      date: "2099-12-31",
    })
  })
})