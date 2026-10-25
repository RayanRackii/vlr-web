import { describe, expect, it } from "vitest"

import {
  dedupeOpenHoursOccupancies,
  occupancyFromDaySlot,
  occupancyIdFromSlot,
  type ScheduleGridOccupancy,
} from "@/features/rentals/components/schedule/scheduleGridModel"

function occupancy(
  overrides: Partial<ScheduleGridOccupancy> &
    Pick<ScheduleGridOccupancy, "startTime" | "endTime"> & {
      reservationId?: string | null
    },
): ScheduleGridOccupancy {
  return {
    id: `${overrides.startTime}-${overrides.endTime}-${overrides.status ?? "available"}`,
    rentalAssetId: "asset-1",
    occupancyKindLabel: "Aberto",
    status: "available",
    ...overrides,
  } as ScheduleGridOccupancy
}

describe("dedupeOpenHoursOccupancies", () => {
  it("collapses overlapping 1h/2h/4h windows to the base duration", () => {
    const occupancies = [
      occupancy({ startTime: "08:00", endTime: "09:00" }),
      occupancy({ startTime: "09:00", endTime: "10:00" }),
      occupancy({ startTime: "08:00", endTime: "10:00" }),
      occupancy({ startTime: "08:00", endTime: "12:00" }),
    ]

    const result = dedupeOpenHoursOccupancies(occupancies, 60)

    expect(result).toHaveLength(2)
    expect(result.every((item) => item.status === "available")).toBe(true)
    expect(result.map((item) => item.startTime).sort()).toEqual(["08:00", "09:00"])
  })

  it("keeps a booked window as a single span and drops overlapping shorter windows", () => {
    const occupancies = [
      occupancy({ startTime: "10:00", endTime: "11:00", status: "booked" }),
      occupancy({ startTime: "11:00", endTime: "12:00", status: "booked" }),
      occupancy({ startTime: "10:00", endTime: "12:00", status: "booked" }),
      occupancy({ startTime: "12:00", endTime: "13:00" }),
    ]

    const result = dedupeOpenHoursOccupancies(occupancies, 60)

    expect(result).toHaveLength(2)
    const booked = result.filter((item) => item.status === "booked")
    expect(booked).toHaveLength(1)
    expect(booked[0]).toMatchObject({ startTime: "10:00", endTime: "12:00" })
  })

  it("drops base-duration windows fully covered by a booked longer window", () => {
    const occupancies = [
      occupancy({ startTime: "14:00", endTime: "15:00" }),
      occupancy({ startTime: "15:00", endTime: "16:00" }),
      occupancy({ startTime: "14:00", endTime: "16:00", status: "booked" }),
    ]

    const result = dedupeOpenHoursOccupancies(occupancies, 60)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startTime: "14:00", endTime: "16:00", status: "booked" })
  })

  it("keeps a longer unavailable window as a span instead of an empty base cell", () => {
    const result = dedupeOpenHoursOccupancies(
      [
        occupancy({ startTime: "08:00", endTime: "09:00" }),
        occupancy({ startTime: "09:00", endTime: "10:00" }),
        occupancy({ startTime: "08:00", endTime: "10:00", status: "unavailable", label: "Fechado" }),
      ],
      60,
    )

    expect(result).toEqual([
      expect.objectContaining({
        startTime: "08:00",
        endTime: "10:00",
        status: "unavailable",
        label: "Fechado",
      }),
    ])
  })

  it("merges overlapping unavailable durations into one span per resource", () => {
    const result = dedupeOpenHoursOccupancies(
      [
        occupancy({ startTime: "08:00", endTime: "09:00", status: "unavailable" }),
        occupancy({ startTime: "08:00", endTime: "10:00", status: "unavailable" }),
        occupancy({ startTime: "09:00", endTime: "11:00", status: "unavailable" }),
        occupancy({
          rentalAssetId: "asset-2",
          startTime: "08:00",
          endTime: "10:00",
          status: "unavailable",
        }),
      ],
      60,
    )

    expect(result).toHaveLength(2)
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rentalAssetId: "asset-1",
          startTime: "08:00",
          endTime: "11:00",
          status: "unavailable",
        }),
        expect.objectContaining({
          rentalAssetId: "asset-2",
          startTime: "08:00",
          endTime: "10:00",
          status: "unavailable",
        }),
      ]),
    )
  })

  it("keeps overlapping unavailable occupancies with distinct labels separate", () => {
    const result = dedupeOpenHoursOccupancies(
      [
        occupancy({
          startTime: "08:00",
          endTime: "10:00",
          status: "unavailable",
          occupancyKindKey: "closed",
          label: "Closed",
        }),
        occupancy({
          startTime: "09:00",
          endTime: "11:00",
          status: "unavailable",
          occupancyKindKey: "closed",
          label: "Lesson",
        }),
      ],
      60,
    )

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startTime: "08:00", endTime: "10:00", label: "Closed" }),
        expect.objectContaining({ startTime: "09:00", endTime: "11:00", label: "Lesson" }),
      ]),
    )
  })

  it("keeps overlapping booked windows from separate reservations distinct", () => {
    const result = dedupeOpenHoursOccupancies(
      [
        occupancy({
          id: "reservation-a-short",
          startTime: "10:00",
          endTime: "11:00",
          status: "booked",
          reservationId: "reservation-a",
        }),
        occupancy({
          id: "reservation-b",
          startTime: "11:00",
          endTime: "12:00",
          status: "booked",
          reservationId: "reservation-b",
        }),
      ],
      60,
    )

    expect(result).toHaveLength(2)
    expect(result.map((item) => item.reservationId).sort()).toEqual([
      "reservation-a",
      "reservation-b",
    ])
  })

  it("collapses partially overlapping windows for the same reservation", () => {
    const result = dedupeOpenHoursOccupancies(
      [
        occupancy({
          id: "reservation-a-first",
          startTime: "09:00",
          endTime: "11:00",
          status: "booked",
          reservationId: "reservation-a",
        }),
        occupancy({
          id: "reservation-a-second",
          startTime: "10:00",
          endTime: "12:00",
          status: "booked",
          reservationId: "reservation-a",
        }),
      ],
      60,
    )

    expect(result).toEqual([
      expect.objectContaining({
        reservationId: "reservation-a",
        startTime: "09:00",
        endTime: "12:00",
        status: "booked",
      }),
    ])
  })
})

describe("occupancyIdFromSlot", () => {
  it("keeps derived booked rows of one good distinct (R10: 3 bookings 12-16)", () => {
    const base = { id: "00000000-0000-0000-0000-000000000000", isDerived: true, rentalAssetId: "projetor", startTime: "12:00:00", endTime: "16:00:00" }
    const ids = ["r1", "r2", "r3"].map((reservationId) => occupancyIdFromSlot({ ...base, reservationId }))
    expect(new Set(ids).size).toBe(3)
    expect(occupancyIdFromSlot({ ...base, endTime: "13:00:00" })).not.toBe(occupancyIdFromSlot(base))
  })

  it("maps a derived booked day slot to a booked occupancy", () => {
    const result = occupancyFromDaySlot({
      id: "00000000-0000-0000-0000-000000000000", rentalAssetId: "sala", assetName: "Sala", date: "2026-10-27",
      startTime: "08:00:00", endTime: "10:00:00", occupancyKindId: "k", occupancyKindKey: "open", occupancyKindLabel: "Open",
      occupancyKindColorHex: "#22C55E", isBookableByCustomer: false, label: null, status: "Booked", reservationId: "res-1",
      isDerived: true, source: "WeeklyDefault", sourceTemplateId: null, schedulePolicy: "OpenHours", supportsEntireRecurrence: false,
    } as Parameters<typeof occupancyFromDaySlot>[0])
    expect(result.status).toBe("booked")
    expect(result.reservationId).toBe("res-1")
  })
})
