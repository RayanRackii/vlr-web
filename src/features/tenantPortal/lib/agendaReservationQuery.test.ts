import { describe, expect, it, vi } from "vitest"

import {
  agendaRefreshDates,
  agendaReservedSlotKey,
  findVisibleAgendaReservation,
  isBlockingReservationStatus,
  parseAgendaReservationQuery,
  reservedSlotKeysForDate,
  retryOnce,
  reservationCivilStart,
  withoutBookableReservedKeys,
  type AgendaReservationHold,
  type AgendaSlotHold,
} from "@/features/tenantPortal/lib/agendaReservationQuery"

const OWNED_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const OTHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

describe("parseAgendaReservationQuery", () => {
  it("returns a lowercase uuid", () => {
    expect(parseAgendaReservationQuery(OWNED_ID)).toBe(OWNED_ID)
    expect(parseAgendaReservationQuery(OWNED_ID.toUpperCase())).toBe(OWNED_ID)
    expect(parseAgendaReservationQuery(`  ${OWNED_ID}  `)).toBe(OWNED_ID)
  })

  it("rejects missing and malformed values", () => {
    expect(parseAgendaReservationQuery(null)).toBeNull()
    expect(parseAgendaReservationQuery(undefined)).toBeNull()
    expect(parseAgendaReservationQuery("")).toBeNull()
    expect(parseAgendaReservationQuery("   ")).toBeNull()
    expect(parseAgendaReservationQuery("not-a-guid")).toBeNull()
    expect(parseAgendaReservationQuery(`${OWNED_ID}-extra`)).toBeNull()
    expect(parseAgendaReservationQuery("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa")).toBeNull()
    expect(parseAgendaReservationQuery("../")).toBeNull()
    expect(parseAgendaReservationQuery("javascript:alert(1)")).toBeNull()
    expect(parseAgendaReservationQuery("<script>alert(1)</script>")).toBeNull()
  })

  it("accepts a nil uuid as an id and leaves selection to the customer's list", () => {
    const nilId = "00000000-0000-0000-0000-000000000000"
    expect(parseAgendaReservationQuery(nilId)).toBe(nilId)
    expect(findVisibleAgendaReservation([{ id: OWNED_ID, status: "Confirmed" }], nilId)).toBeNull()
  })
})

describe("findVisibleAgendaReservation", () => {
  const reservations = [
    { id: OTHER_ID, status: "Confirmed" },
    { id: OWNED_ID, status: "Confirmed" },
  ]

  it("returns the owned visible reservation", () => {
    expect(findVisibleAgendaReservation(reservations, OWNED_ID)).toEqual({
      id: OWNED_ID,
      status: "Confirmed",
    })
    expect(
      findVisibleAgendaReservation(reservations, OWNED_ID.toUpperCase()),
    ).toEqual({ id: OWNED_ID, status: "Confirmed" })
  })

  it.each(["PendingDeposit", "Confirmed", "Completed"])(
    "keeps %s reservations that Minhas reservas still shows",
    (status) => {
      expect(
        findVisibleAgendaReservation([{ id: OWNED_ID, status }], OWNED_ID)?.status,
      ).toBe(status)
    },
  )

  it("ignores canceled rows, missing ids, and ids outside the list", () => {
    expect(
      findVisibleAgendaReservation(
        [{ id: OWNED_ID, status: "Canceled" }],
        OWNED_ID,
      ),
    ).toBeNull()
    expect(
      findVisibleAgendaReservation(
        [{ id: OWNED_ID, status: "Cancelled" }],
        OWNED_ID,
      ),
    ).toBeNull()
    expect(
      findVisibleAgendaReservation(
        [{ id: OWNED_ID, status: " Canceled " }],
        OWNED_ID,
      ),
    ).toBeNull()
    expect(findVisibleAgendaReservation(reservations, null)).toBeNull()
    expect(findVisibleAgendaReservation(reservations, OTHER_ID.slice(0, -1) + "c")).toBeNull()
    expect(findVisibleAgendaReservation([], OWNED_ID)).toBeNull()
    expect(findVisibleAgendaReservation(reservations, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toBeNull()
  })

  it("does not treat a neighbor row as the requested reservation", () => {
    const selected = findVisibleAgendaReservation(reservations, OWNED_ID)
    expect(selected?.id).toBe(OWNED_ID)
    expect(selected?.id).not.toBe(OTHER_ID)
  })
})

const ASSET_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ASSET_ID = "22222222-2222-4222-8222-222222222222"
const VIEWED_DATE = "2026-10-14"
const OTHER_DATE = "2026-10-15"

function hold(
  status: string,
  startDateTime: string,
  rentalAssetId = ASSET_ID,
): AgendaReservationHold {
  return {
    id: OWNED_ID,
    status,
    startDateTime,
    items: [{ rentalAssetId }],
  }
}

function slot(overrides: Partial<AgendaSlotHold> = {}): AgendaSlotHold {
  return {
    rentalAssetId: ASSET_ID,
    startTime: "08:00:00",
    reservationId: null,
    isBookableByCustomer: true,
    status: "available",
    ...overrides,
  }
}

describe("reservedSlotKeysForDate", () => {
  it("keys a blocking reservation by its Sao Paulo civil date and start", () => {
    expect(reservationCivilStart("2026-10-14T11:00:00.000Z")).toEqual({
      date: VIEWED_DATE,
      time: "08:00",
    })
    expect(reservationCivilStart("2026-10-15T02:30:00.000Z")).toEqual({
      date: VIEWED_DATE,
      time: "23:30",
    })
    expect(reservationCivilStart("not-a-date")).toBeNull()
    expect(isBlockingReservationStatus(" Confirmed ")).toBe(true)
    expect(isBlockingReservationStatus("PendingDeposit")).toBe(true)
    expect(isBlockingReservationStatus("Canceled")).toBe(false)
    expect(isBlockingReservationStatus("Cancelled")).toBe(false)

    const keys = reservedSlotKeysForDate(
      VIEWED_DATE,
      [hold("Confirmed", "2026-10-14T11:00:00.000Z")],
      [],
    )
    expect(keys).toEqual(
      new Set([agendaReservedSlotKey(VIEWED_DATE, ASSET_ID, "08:00")]),
    )
  })

  it("ignores a blocking reservation that starts on another date", () => {
    const keys = reservedSlotKeysForDate(
      VIEWED_DATE,
      [hold("Confirmed", "2026-10-15T11:00:00.000Z")],
      [],
    )
    expect(keys.size).toBe(0)
  })

  it("drops the key when the same reservation is canceled", () => {
    const reservations = [hold("Canceled", "2026-10-14T11:00:00.000Z")]
    const slots = [
      slot({
        isBookableByCustomer: false,
        status: "booked",
        reservationId: OWNED_ID,
      }),
    ]
    expect(reservedSlotKeysForDate(VIEWED_DATE, reservations, slots).size).toBe(0)
  })

  it("marks a non-bookable row when its reservationId is a blocking reservation", () => {
    const keys = reservedSlotKeysForDate(
      VIEWED_DATE,
      [hold("PendingDeposit", "2026-10-14T11:00:00.000Z", OTHER_ASSET_ID)],
      [
        slot({
          isBookableByCustomer: false,
          status: "booked",
          reservationId: OWNED_ID.toUpperCase(),
        }),
      ],
    )
    expect(keys.has(agendaReservedSlotKey(VIEWED_DATE, ASSET_ID, "08:00:00"))).toBe(
      true,
    )
  })

  it("does not mark another customer's reservation or a bookable row", () => {
    const keys = reservedSlotKeysForDate(
      VIEWED_DATE,
      [hold("Confirmed", "2026-10-14T15:00:00.000Z")],
      [
        slot({
          isBookableByCustomer: false,
          status: "booked",
          reservationId: OTHER_ID,
        }),
        slot({
          startTime: "12:00:00",
          reservationId: OWNED_ID,
          isBookableByCustomer: true,
          status: "available",
        }),
      ],
    )
    expect(keys.has(agendaReservedSlotKey(VIEWED_DATE, ASSET_ID, "08:00"))).toBe(
      false,
    )
    expect(keys.has(agendaReservedSlotKey(VIEWED_DATE, ASSET_ID, "12:00"))).toBe(
      true,
    )
  })

  it("removes only the viewed date's keys once the server says the slot is bookable", () => {
    const today = agendaReservedSlotKey(VIEWED_DATE, ASSET_ID, "08:00")
    const tomorrow = agendaReservedSlotKey(OTHER_DATE, ASSET_ID, "08:00")
    const keys = new Set([today, tomorrow])
    const next = withoutBookableReservedKeys(keys, VIEWED_DATE, [
      { rentalAssetId: ASSET_ID, startTime: "08:00:00" },
    ])
    expect(next.has(today)).toBe(false)
    expect(next.has(tomorrow)).toBe(true)
    expect(withoutBookableReservedKeys(next, OTHER_DATE, [])).toBe(next)
  })

  it("refetches the viewed date and the reservation date", () => {
    expect(
      agendaRefreshDates(VIEWED_DATE, [
        { startDateTime: "2026-10-15T11:00:00.000Z" },
        { startDateTime: "2026-10-15T12:00:00.000Z" },
        { startDateTime: "nope" },
      ]),
    ).toEqual([VIEWED_DATE, OTHER_DATE])
    expect(
      agendaRefreshDates(VIEWED_DATE, [
        { startDateTime: "2026-10-14T11:00:00.000Z" },
      ]),
    ).toEqual([VIEWED_DATE])
  })
})

describe("retryOnce", () => {
  it("returns the first success without a second call", async () => {
    const operation = vi.fn().mockResolvedValue("ok")
    await expect(retryOnce(operation)).resolves.toBe("ok")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it("retries once and surfaces the second failure", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
    await expect(retryOnce(operation)).rejects.toThrow("second")
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it("returns the second attempt when the first fails", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValueOnce("recovered")
    await expect(retryOnce(operation)).resolves.toBe("recovered")
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
