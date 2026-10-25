import { describe, expect, it } from "vitest"

import {
  buildMultiSlotWindows,
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

describe("buildMultiSlotWindows", () => {
  const asset = {
    id: ASSET_ID,
    schedulePolicy: "SlotGrid",
    allowedDurationMinutes: "30, 60, 90, 90",
  }
  const bookableSlot = (startTime: string, endTime: string, overrides = {}) => ({
    id: `${startTime}-${endTime}`,
    rentalAssetId: ASSET_ID,
    assetName: "Resource A",
    date: "2026-10-14",
    occupancyKindId: "open",
    occupancyKindKey: "open",
    occupancyKindLabel: "Open",
    isBookableByCustomer: true,
    status: "Available",
    reservationId: null,
    isDerived: false,
    startTime,
    endTime,
    ...overrides,
  })

  it("adds only allowed contiguous multi-window durations", () => {
    const windows = buildMultiSlotWindows(
      [
        bookableSlot("08:00", "08:30"),
        bookableSlot("08:30", "09:00"),
        bookableSlot("09:00", "09:30"),
        bookableSlot("09:30", "10:00"),
      ],
      [asset],
    )

    expect(windows.map(({ startTime, endTime }) => [startTime, endTime])).toEqual([
      ["08:00", "09:00"], ["08:00", "09:30"], ["08:30", "09:30"],
      ["08:30", "10:00"], ["09:00", "10:00"],
    ])
    expect(windows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "00000000-0000-0000-0000-000000000000", isDerived: true, status: "Available" }),
    ]))
  })

  it("stops at unavailable and missing slots, ignores ineligible assets, and keeps assets isolated", () => {
    const otherAsset = { ...asset, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }
    const windows = buildMultiSlotWindows(
      [
        bookableSlot("08:00", "08:30"),
        bookableSlot("08:30", "09:00", { isBookableByCustomer: false, status: "Booked" }),
        bookableSlot("09:00", "09:30"),
        bookableSlot("10:00", "10:30", { rentalAssetId: otherAsset.id }),
        bookableSlot("10:30", "11:00", { rentalAssetId: otherAsset.id }),
      ],
      [asset, otherAsset],
    )

    expect(windows).toHaveLength(1)
    expect(windows[0]).toMatchObject({ rentalAssetId: otherAsset.id, startTime: "10:00", endTime: "11:00" })
    expect(buildMultiSlotWindows([bookableSlot("08:00", "08:30"), bookableSlot("08:30", "09:00")], [{ ...asset, schedulePolicy: "OpenHours" }])).toEqual([])
    expect(buildMultiSlotWindows([bookableSlot("08:00", "08:30"), bookableSlot("08:30", "09:00")], [{ ...asset, allowedDurationMinutes: null }])).toEqual([])
    expect(buildMultiSlotWindows([bookableSlot("08:00", "08:30"), bookableSlot("08:30", "09:00")], [{ ...asset, allowedDurationMinutes: "" }])).toEqual([])
  })

  it("does not duplicate a real range and handles a day-closing slot", () => {
    const windows = buildMultiSlotWindows(
      [
        bookableSlot("23:00", "23:30"),
        bookableSlot("23:30", "23:59"),
        bookableSlot("23:00", "23:59", { id: "real-60" }),
      ],
      [{ ...asset, allowedDurationMinutes: "60" }],
    )

    expect(windows).toEqual([])
  })
})
