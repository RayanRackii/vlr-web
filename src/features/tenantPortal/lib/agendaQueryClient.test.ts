import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchPublicScheduleDay: vi.fn(),
    listMyPortalReservations: vi.fn(),
  }
})

import { toast } from "sonner"
import {
  clearAgendaQueryClient,
  commitPortalBooking,
  customerAlreadyHoldsSlot,
  forgetOwnBooking,
  forgetRecentReservation,
  getAgendaQueryRevision,
  invalidateAgendaQueries,
  isOwnBookedSlot,
  isPortalBookingInFlight,
  mergeServerReservations,
  recentPortalReservations,
  rememberOwnBooking,
  releaseCancelledOwnSlots,
  resetAgendaQueryClientForTests,
  subscribeAgendaQueries,
  type AgendaQuerySnapshot,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import { PortalBookingError } from "@/features/tenantPortal/lib/portalBookingError"
import {
  fetchPublicScheduleDay,
  listMyPortalReservations,
  type PortalReservation,
} from "@/features/tenantPortal/services/tenantPortalService"

const listMine = vi.mocked(listMyPortalReservations)
const fetchDay = vi.mocked(fetchPublicScheduleDay)
const toastError = vi.mocked(toast.error)

const RENTAL_ASSET_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ASSET_ID = "22222222-2222-4222-8222-222222222222"

function reservation(): PortalReservation {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    customerName: "Ana Souza",
    customerWhatsApp: "+5511999999999",
    startDateTime: "2026-10-14T11:00:00.000Z",
    endDateTime: "2026-10-14T12:00:00.000Z",
    status: "Confirmed",
    totalAmount: 80,
    depositPaid: 0,
    createdAt: "2026-10-14T10:00:00.000Z",
    items: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        rentalAssetId: RENTAL_ASSET_ID,
        assetName: "Sala 1",
        quantity: 1,
        unitPrice: 80,
        subTotal: 80,
      },
    ],
  }
}

describe("agendaQueryClient", () => {
  beforeEach(() => {
    resetAgendaQueryClientForTests()
    listMine.mockReset()
    fetchDay.mockReset()
    toastError.mockReset()
    listMine.mockResolvedValue([])
    fetchDay.mockResolvedValue({ date: "2026-10-14", slots: [] })
  })

  it("refetches bookings and the day even when nobody is subscribed yet", async () => {
    const created = reservation()
    listMine.mockResolvedValue([created])

    await commitPortalBooking(async () => created, {
      subdomain: "ficc",
      dates: ["2026-10-14"],
    })

    expect(listMine).toHaveBeenCalledTimes(1)
    expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-14")
    expect(isOwnBookedSlot("2026-10-14", RENTAL_ASSET_ID, "08:00:00")).toBe(true)
    expect(isOwnBookedSlot("2026-10-14", OTHER_ASSET_ID, "08:00:00")).toBe(false)
  })

  it("delivers the snapshot to a subscriber that mounted while the refetch was in flight", async () => {
    const created = reservation()
    let releaseList: (rows: PortalReservation[]) => void = () => {}
    listMine.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseList = resolve
        }),
    )
    const seen: AgendaQuerySnapshot[] = []
    const pending = invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )
    const unsubscribe = subscribeAgendaQueries((snapshot) => {
      seen.push(snapshot)
    })

    releaseList([created])
    await pending

    expect(seen).toHaveLength(1)
    expect(seen[0]?.reservations).toEqual([created])
    expect(seen[0]?.applySlots).toBe(true)
    expect(seen[0]?.days[0]?.dayDate).toBe("2026-10-14")
    unsubscribe()
  })

  it("ignores a stale refetch after a newer invalidation", async () => {
    const first = reservation()
    const second = { ...reservation(), id: "99999999-9999-4999-8999-999999999999" }
    let releaseFirst: (rows: PortalReservation[]) => void = () => {}
    let releaseSecond: (rows: PortalReservation[]) => void = () => {}
    let calls = 0
    listMine.mockImplementation(
      () =>
        new Promise((resolve) => {
          calls += 1
          if (calls === 1) {
            releaseFirst = resolve
            return
          }
          releaseSecond = resolve
        }),
    )
    const seen: string[] = []
    const unsubscribe = subscribeAgendaQueries((snapshot) => {
      seen.push(snapshot.reservations[0]?.id ?? "")
    })

    const older = invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )
    const newer = invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )
    releaseSecond([second])
    await newer
    releaseFirst([first])
    await older

    expect(seen).toEqual([second.id])
    unsubscribe()
  })

  it("toasts once when the slot refresh keeps failing", async () => {
    fetchDay.mockRejectedValue(new Error("schedule down"))

    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )

    expect(fetchDay).toHaveBeenCalledTimes(2)
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith("schedule down")
  })

  it("does not toast a slot error when the refresh must not replace the picker", async () => {
    fetchDay.mockRejectedValue(new Error("schedule down"))

    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: false },
    )

    expect(toastError).not.toHaveBeenCalled()
  })

  it("treats this browser's booking and Minhas reservas as already held", () => {
    const created = reservation()
    expect(
      customerAlreadyHoldsSlot("2026-10-14", RENTAL_ASSET_ID, "08:00", []),
    ).toBe(false)

    rememberOwnBooking(created)
    expect(
      customerAlreadyHoldsSlot("2026-10-14", RENTAL_ASSET_ID, "08:00:00", []),
    ).toBe(true)

    forgetOwnBooking(created)
    expect(isOwnBookedSlot("2026-10-14", RENTAL_ASSET_ID, "08:00:00")).toBe(false)
    expect(
      customerAlreadyHoldsSlot("2026-10-14", RENTAL_ASSET_ID, "08:00", [
        {
          id: created.id,
          status: "Confirmed",
          startDateTime: created.startDateTime,
          items: [{ rentalAssetId: RENTAL_ASSET_ID }],
        },
      ]),
    ).toBe(true)
    expect(getAgendaQueryRevision()).toBeGreaterThan(0)
  })

  it("keeps rows the snapshot does not list, then appends the snapshot", () => {
    const local = { id: "local" }
    const shared = { id: "shared", status: "old" }
    const incoming = { id: "shared", status: "new" }
    const added = { id: "added" }

    expect(mergeServerReservations([local, shared], [incoming, added])).toEqual([
      local,
      incoming,
      added,
    ])
  })

  it("drops the own-slot key when a refresh lists that booking as cancelled", async () => {
    const created = reservation()
    rememberOwnBooking(created)
    expect(
      customerAlreadyHoldsSlot("2026-10-14", RENTAL_ASSET_ID, "08:00", []),
    ).toBe(true)

    listMine.mockResolvedValue([{ ...created, status: "Cancelled" }])
    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: false },
    )

    expect(isOwnBookedSlot("2026-10-14", RENTAL_ASSET_ID, "08:00")).toBe(false)
    expect(
      customerAlreadyHoldsSlot("2026-10-14", RENTAL_ASSET_ID, "08:00", []),
    ).toBe(false)

    rememberOwnBooking(created)
    releaseCancelledOwnSlots([{ ...created, status: "Canceled" }])
    expect(isOwnBookedSlot("2026-10-14", RENTAL_ASSET_ID, "08:00")).toBe(false)
  })

  it("keeps the own-slot key when the refresh still lists the booking", async () => {
    const created = reservation()
    rememberOwnBooking(created)
    listMine.mockResolvedValue([created])

    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: false },
    )

    expect(isOwnBookedSlot("2026-10-14", RENTAL_ASSET_ID, "08:00")).toBe(true)
  })

  it("still refetches after a slot conflict", async () => {
    const pending = commitPortalBooking(
      async () => {
        throw new PortalBookingError(
          "O local 'Sala 1' não está disponível para o intervalo solicitado.",
          409,
          null,
        )
      },
      { subdomain: "ficc", dates: ["2026-10-15"] },
    )

    await expect(pending).rejects.toBeInstanceOf(PortalBookingError)
    await vi.waitFor(() => {
      expect(fetchDay).toHaveBeenCalledWith("ficc", "2026-10-15")
    })
    expect(isOwnBookedSlot("2026-10-15", RENTAL_ASSET_ID, "08:00:00")).toBe(false)
  })

  it("does not send a second booking while the same slot is in flight", async () => {
    const created = reservation()
    let calls = 0
    let resolveBook: (value: PortalReservation) => void = () => undefined
    const slot = {
      date: "2026-10-14",
      rentalAssetId: RENTAL_ASSET_ID,
      startTime: "08:00:00",
    }
    const first = commitPortalBooking(
      () => {
        calls += 1
        return new Promise<PortalReservation>((resolve) => {
          resolveBook = resolve
        })
      },
      { subdomain: "ficc", dates: ["2026-10-14"] },
      slot,
    )
    const second = commitPortalBooking(
      async () => {
        calls += 1
        return created
      },
      { subdomain: "ficc", dates: ["2026-10-14"] },
      slot,
    )

    expect(calls).toBe(1)
    expect(isPortalBookingInFlight("2026-10-14", RENTAL_ASSET_ID, "08:00")).toBe(
      true,
    )
    resolveBook(created)
    await expect(first).resolves.toBe(created)
    await expect(second).resolves.toBe(created)
    expect(calls).toBe(1)
    expect(isPortalBookingInFlight("2026-10-14", RENTAL_ASSET_ID, "08:00")).toBe(
      false,
    )
  })

  it("keeps the created reservation when the follow-up list is still empty", async () => {
    const created = reservation()
    listMine.mockResolvedValue([])
    const seen: PortalReservation[][] = []
    const unsubscribe = subscribeAgendaQueries((snapshot) => {
      seen.push(snapshot.reservations)
    })

    await commitPortalBooking(async () => created, {
      subdomain: "ficc",
      dates: ["2026-10-14"],
    })

    await vi.waitFor(() => {
      expect(seen.length).toBeGreaterThan(0)
    })
    expect(seen.at(-1)?.map((row) => row.id)).toContain(created.id)
    expect(recentPortalReservations("Ficc").map((row) => row.id)).toEqual([
      created.id,
    ])
    unsubscribe()
  })

  it("discards a booking that finishes after logout without touching the next session", async () => {
    const slot = {
      date: "2026-10-14",
      rentalAssetId: RENTAL_ASSET_ID,
      startTime: "08:00",
    }
    const scope = { subdomain: "ficc", dates: [slot.date] }
    let resolvePrevious: (value: PortalReservation) => void = () => undefined
    let resolveCurrent: (value: PortalReservation) => void = () => undefined
    const previous = commitPortalBooking(
      () => new Promise<PortalReservation>((resolve) => {
        resolvePrevious = resolve
      }),
      scope,
      slot,
    )
    const discarded = expect(previous).rejects.toMatchObject({ name: "AbortError" })

    clearAgendaQueryClient()
    const seen = vi.fn()
    subscribeAgendaQueries(seen)
    const currentRequest = vi.fn(
      () => new Promise<PortalReservation>((resolve) => {
        resolveCurrent = resolve
      }),
    )
    const current = commitPortalBooking(currentRequest, scope, slot)
    resolvePrevious(reservation())
    await discarded

    expect(currentRequest).toHaveBeenCalledTimes(1)
    expect(recentPortalReservations("ficc")).toEqual([])
    expect(isOwnBookedSlot(slot.date, slot.rentalAssetId, slot.startTime)).toBe(false)
    expect(isPortalBookingInFlight(slot.date, slot.rentalAssetId, slot.startTime)).toBe(true)
    expect(listMine).not.toHaveBeenCalled()
    expect(fetchDay).not.toHaveBeenCalled()
    expect(seen).not.toHaveBeenCalled()

    const created = { ...reservation(), customerId: "next-customer", id: "next-reservation" }
    resolveCurrent(created)
    await current
    await vi.waitFor(() => expect(seen).toHaveBeenCalledTimes(1))
    expect(recentPortalReservations("ficc")).toEqual([created])
    expect(seen.mock.calls[0]?.[0].reservations).toEqual([created])
  })

  it("does not refetch a conflict from a signed-out session", async () => {
    let rejectRequest: (reason: unknown) => void = () => undefined
    const pending = commitPortalBooking(
      () => new Promise<PortalReservation>((_resolve, reject) => {
        rejectRequest = reject
      }),
      { subdomain: "ficc", dates: ["2026-10-14"] },
    )
    const discarded = expect(pending).rejects.toMatchObject({ name: "AbortError" })
    clearAgendaQueryClient()
    rejectRequest(new PortalBookingError("Already reserved for this interval.", 409, null))
    await discarded
    expect(listMine).not.toHaveBeenCalled()
    expect(fetchDay).not.toHaveBeenCalled()
  })

  it("discards an old refresh and does not retry it with the next session", async () => {
    let rejectList: (reason: unknown) => void = () => undefined
    listMine.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectList = reject
    }))
    const pending = invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )
    clearAgendaQueryClient()
    const seen = vi.fn()
    subscribeAgendaQueries(seen)
    rejectList(new Error("old session failed"))
    await pending
    expect(listMine).toHaveBeenCalledTimes(1)
    expect(fetchDay).toHaveBeenCalledTimes(1)
    expect(seen).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("does not deliver a previous customer's pending list to a new subscriber", async () => {
    let resolveList: (rows: PortalReservation[]) => void = () => undefined
    listMine.mockImplementationOnce(() => new Promise((resolve) => {
      resolveList = resolve
    }))
    const pending = invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )
    clearAgendaQueryClient()
    const seen = vi.fn()
    subscribeAgendaQueries(seen)
    resolveList([reservation()])
    await pending

    expect(seen).not.toHaveBeenCalled()
    expect(recentPortalReservations("ficc")).toEqual([])
  })

  it("drops a cancelled reservation so an empty list cannot restore it", async () => {
    const created = reservation()
    listMine.mockResolvedValue([])
    await commitPortalBooking(async () => created, {
      subdomain: "ficc",
      dates: ["2026-10-14"],
    })
    forgetRecentReservation(created.id)

    const seen: PortalReservation[][] = []
    const unsubscribe = subscribeAgendaQueries((snapshot) => {
      seen.push(snapshot.reservations)
    })
    await invalidateAgendaQueries(
      { subdomain: "ficc", dates: ["2026-10-14"] },
      { applySlots: true },
    )

    expect(seen.at(-1) ?? []).toEqual([])
    expect(recentPortalReservations("ficc")).toEqual([])
    unsubscribe()
  })
})
