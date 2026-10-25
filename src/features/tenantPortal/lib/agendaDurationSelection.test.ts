import { describe, expect, it } from "vitest"

import {
  findSlotAtStartAndDuration,
  formatDurationLabel,
  listDistinctDurations,
  listStartTimesForDuration,
  resolveEffectiveDuration,
  slotDurationMinutes,
} from "@/features/tenantPortal/lib/agendaDurationSelection"

const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function slot(startTime: string, endTime: string, rentalAssetId = ASSET_ID) {
  return { rentalAssetId, startTime, endTime }
}

describe("slotDurationMinutes", () => {
  it("computes the minutes between start and end", () => {
    expect(slotDurationMinutes(slot("08:00:00", "09:00:00"))).toBe(60)
    expect(slotDurationMinutes(slot("08:00", "10:00"))).toBe(120)
    expect(slotDurationMinutes(slot("08:00", "08:30"))).toBe(30)
  })
})

describe("listDistinctDurations", () => {
  it("returns the distinct durations across overlapping windows, ascending", () => {
    const slots = [
      slot("08:00:00", "09:00:00"),
      slot("09:00:00", "10:00:00"),
      slot("08:00:00", "10:00:00"),
      slot("08:00:00", "12:00:00"),
    ]
    expect(listDistinctDurations(slots)).toEqual([60, 120, 240])
  })

  it("is empty for no slots", () => {
    expect(listDistinctDurations([])).toEqual([])
  })
})

describe("listStartTimesForDuration", () => {
  const slots = [
    slot("08:00:00", "09:00:00"),
    slot("09:00:00", "10:00:00"),
    slot("08:00:00", "10:00:00"),
  ]

  it("keeps only the start times matching the requested duration", () => {
    expect(listStartTimesForDuration(slots, 60)).toEqual([
      { startTime: "08:00", endTime: "09:00" },
      { startTime: "09:00", endTime: "10:00" },
    ])
    expect(listStartTimesForDuration(slots, 120)).toEqual([
      { startTime: "08:00", endTime: "10:00" },
    ])
    expect(listStartTimesForDuration(slots, 240)).toEqual([])
  })
})

describe("findSlotAtStartAndDuration", () => {
  const slots = [
    { ...slot("08:00:00", "09:00:00"), id: "1h" },
    { ...slot("08:00:00", "10:00:00"), id: "2h" },
  ]

  it("matches the slot with the requested resource, start and duration", () => {
    expect(findSlotAtStartAndDuration(slots, ASSET_ID, "08:00", 120)?.id).toBe(
      "2h",
    )
    expect(findSlotAtStartAndDuration(slots, ASSET_ID, "08:00", 60)?.id).toBe(
      "1h",
    )
    expect(
      findSlotAtStartAndDuration(slots, ASSET_ID, "08:00", 180),
    ).toBeUndefined()
  })
})

describe("formatDurationLabel", () => {
  it("formats whole hours, mixed and sub-hour durations", () => {
    expect(formatDurationLabel(60)).toBe("1h")
    expect(formatDurationLabel(120)).toBe("2h")
    expect(formatDurationLabel(240)).toBe("4h")
    expect(formatDurationLabel(90)).toBe("1h30")
    expect(formatDurationLabel(30)).toBe("30min")
  })
})

describe("resolveEffectiveDuration", () => {
  it("keeps the selected duration when still offered", () => {
    expect(resolveEffectiveDuration([60, 120, 240], 120)).toBe(120)
  })

  it("falls back to the shortest duration otherwise", () => {
    expect(resolveEffectiveDuration([60, 120, 240], 480)).toBe(60)
    expect(resolveEffectiveDuration([60, 120, 240], null)).toBe(60)
    expect(resolveEffectiveDuration([], 60)).toBeNull()
  })
})

describe("day-closing slots", () => {
  it("treats 23:59:59 and 00:00 ends as midnight", () => {
    expect(slotDurationMinutes({ startTime: "23:30:00", endTime: "23:59:59" })).toBe(30)
    expect(slotDurationMinutes({ startTime: "23:00", endTime: "23:59" })).toBe(60)
    expect(slotDurationMinutes({ startTime: "23:00", endTime: "00:00" })).toBe(60)
    expect(listStartTimesForDuration([{ startTime: "23:30:00", endTime: "23:59:59" }], 30))
      .toEqual([{ startTime: "23:30", endTime: "00:00" }])
  })
})
