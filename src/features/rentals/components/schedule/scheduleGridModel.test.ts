import { describe, expect, it } from "vitest"

import {
  dedupeOpenHoursOccupancies,
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
})
