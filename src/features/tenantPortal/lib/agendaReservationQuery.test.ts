import { describe, expect, it } from "vitest"

import {
  findVisibleAgendaReservation,
  parseAgendaReservationQuery,
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
