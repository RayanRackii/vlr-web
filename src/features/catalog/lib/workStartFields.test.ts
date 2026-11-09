import { describe, expect, it } from "vitest"

import { composeWorkStart } from "@/features/catalog/lib/workStartFields"

describe("composeWorkStart", () => {
  it("keeps day 11 and month 10 in that order", () => {
    expect(composeWorkStart({
      day: "11",
      month: "10",
      year: "2026",
      hour: "14",
      minute: "0",
    })).toBe("2026-10-11T14:00")
  })

  it("rejects a blank hour, a blank minute, or both", () => {
    const date = { day: "11", month: "10", year: "2026" }
    expect(composeWorkStart({ ...date, hour: "", minute: "30" })).toBeNull()
    expect(composeWorkStart({ ...date, hour: "14", minute: "" })).toBeNull()
    expect(composeWorkStart({ ...date, hour: "", minute: "" })).toBeNull()
    expect(composeWorkStart({ ...date, hour: " ", minute: "  " })).toBeNull()
  })

  it("keeps an explicit midnight", () => {
    expect(composeWorkStart({
      day: "11",
      month: "10",
      year: "2026",
      hour: "0",
      minute: "0",
    })).toBe("2026-10-11T00:00")
  })

  it("rejects a swapped or impossible calendar date", () => {
    expect(composeWorkStart({
      day: "31",
      month: "2",
      year: "2026",
      hour: "9",
      minute: "0",
    })).toBeNull()
  })
})
