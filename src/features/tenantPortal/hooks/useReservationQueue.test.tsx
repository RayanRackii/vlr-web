import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import type { ReservationQueueStatus } from "@/features/tenantPortal/services/tenantPortalService"

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchReservationQueue: vi.fn(),
    joinReservationQueue: vi.fn(),
    leaveReservationQueue: vi.fn(),
  }
})

import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import { toast } from "sonner"
import { signOutCustomerPortal } from "@/lib/sessionRestoreGuard"
import {
  fetchReservationQueue,
  joinReservationQueue,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"

const ASSET_ID = "11111111-1111-4111-8111-111111111111"
const TICKET_ID = "99999999-9999-4999-8999-999999999991"

const fetchQueue = vi.mocked(fetchReservationQueue)
const joinQueue = vi.mocked(joinReservationQueue)

function queueTicket(
  status: "Waiting" | "Active" | "Expired",
  overrides: Partial<NonNullable<ReservationQueueStatus["myTicket"]>> = {},
): NonNullable<ReservationQueueStatus["myTicket"]> {
  return {
    id: TICKET_ID,
    status,
    sequence: 1,
    position: status === "Waiting" ? 2 : 1,
    joinedAt: "2026-10-15T08:00:00.000Z",
    turnStartedAt: status === "Active" ? "2026-10-15T08:00:00.000Z" : null,
    turnExpiresAt: status === "Active" ? "2026-10-15T08:01:30.000Z" : null,
    completedReservationId: null,
    ...overrides,
  }
}

function queueStatus(
  overrides: Partial<ReservationQueueStatus> = {},
): ReservationQueueStatus {
  return {
    rentalAssetId: ASSET_ID,
    queueEnabled: true,
    openingDate: "2026-10-15",
    opensAt: "2026-10-15T13:00:00.000Z",
    waitingRoomOpensAt: "2026-10-15T12:30:00.000Z",
    serverNow: "2026-10-15T08:00:00.000Z",
    phase: "Open",
    waitingCount: 0,
    aheadCount: 0,
    myTicket: null,
    ...overrides,
  }
}

describe("useReservationQueue views", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-15T08:00:00.000Z"),
    })
    fetchQueue.mockReset()
    joinQueue.mockReset()
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stays hidden and silent when the resource does not require a queue", () => {
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: false }),
    )

    expect(result.current.view).toEqual({ kind: "hidden" })
    expect(result.current.explanation).toBeNull()
    expect(result.current.canReserve).toBe(true)
    expect(fetchQueue).not.toHaveBeenCalled()
  })

  it("hides the explanation when the queue is turned off", async () => {
    fetchQueue.mockResolvedValue(queueStatus({ queueEnabled: false }))
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.canReserve).toBe(true)
      expect(result.current.explanation).toBeNull()
    })
    expect(result.current.view).toEqual({ kind: "hidden" })
  })

  it("shows the join view without a combined action while the waiting room is open", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ phase: "WaitingRoom", aheadCount: 0, waitingCount: 0 }),
    )
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({
        kind: "join",
        joinAndReserve: false,
      })
    })
    expect(result.current.explanation).toBe(
      i18n.t("tenantPortal.agenda.queue.requiresTicket"),
    )
    expect(result.current.canReserve).toBe(false)
  })

  it("offers join-and-reserve only when the queue is open and nobody is ahead", async () => {
    fetchQueue.mockResolvedValue(queueStatus())
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({
        kind: "join",
        joinAndReserve: true,
      })
    })
    expect(result.current.canReserve).toBe(false)
  })

  it("keeps a plain join view when people are already ahead", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ phase: "Open", aheadCount: 2, waitingCount: 2 }),
    )
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({
        kind: "join",
        joinAndReserve: false,
      })
    })
  })

  it("shows the waiting view", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({
        aheadCount: 1,
        waitingCount: 2,
        myTicket: queueTicket("Waiting"),
      }),
    )
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({
        kind: "waiting",
        position: 2,
        aheadCount: 1,
      })
    })
    expect(result.current.explanation).toBe(
      i18n.t("tenantPortal.agenda.queue.requiresTicket"),
    )
    expect(result.current.canReserve).toBe(false)
  })

  it("shows the active view with the remaining turn", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ myTicket: queueTicket("Active") }),
    )
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({
        kind: "active",
        countdown: "01:30",
      })
    })
    expect(result.current.canReserve).toBe(true)
    expect(result.current.explanation).toBe(
      i18n.t("tenantPortal.agenda.queue.requiresTicket"),
    )
  })

  it("shows the expired view and hides reserve", async () => {
    fetchQueue.mockResolvedValue(
      queueStatus({ myTicket: queueTicket("Expired") }),
    )
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({ kind: "expired" })
    })
    expect(result.current.hideReserveUi).toBe(true)
    expect(result.current.canReserve).toBe(false)
    expect(result.current.explanation).toBe(
      i18n.t("tenantPortal.agenda.queue.requiresTicket"),
    )
  })

  it("shows the closed view with opening times", async () => {
    fetchQueue.mockResolvedValue(queueStatus({ phase: "Closed" }))
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view).toEqual({
        kind: "closed",
        waitingRoomTime: "09:30",
        opensTime: "10:00",
      })
    })
    expect(result.current.canReserve).toBe(false)
    expect(result.current.explanation).toBe(
      i18n.t("tenantPortal.agenda.queue.requiresTicket"),
    )
  })

  it("returns the joined status so the page can reserve an active ticket", async () => {
    const joined = queueStatus({ myTicket: queueTicket("Active") })
    fetchQueue.mockResolvedValue(queueStatus())
    joinQueue.mockResolvedValue(joined)
    const { result } = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )

    await waitFor(() => {
      expect(result.current.view.kind).toBe("join")
    })
    await expect(result.current.join()).resolves.toEqual(joined)
    expect(joinQueue).toHaveBeenCalledWith(ASSET_ID)
  })

  it.each(["resolved", "rejected"] as const)("discards a %s join before any effects in the next session", async (outcome) => {
    let resolveJoin: (value: ReservationQueueStatus) => void = () => undefined
    let rejectJoin: (reason: Error) => void = () => undefined
    const pending = new Promise<ReservationQueueStatus>((resolve, reject) => {
      resolveJoin = resolve
      rejectJoin = reject
    })
    fetchQueue.mockResolvedValue(queueStatus())
    joinQueue.mockReturnValue(pending)
    const previous = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )
    await waitFor(() => expect(previous.result.current.view.kind).toBe("join"))
    let joining: Promise<ReservationQueueStatus | null> = Promise.resolve(null)
    act(() => { joining = previous.result.current.join() })

    previous.unmount()
    signOutCustomerPortal("ficc")
    persistCustomerSession("customer-B", "ficc", "Bruno")
    const next = renderHook(() =>
      useReservationQueue({ rentalAssetId: ASSET_ID, enabled: true }),
    )
    await waitFor(() => expect(next.result.current.view.kind).toBe("join"))
    fetchQueue.mockClear()

    await act(async () => {
      if (outcome === "resolved") {
        resolveJoin(queueStatus({ myTicket: queueTicket("Active") }))
      } else {
        rejectJoin(new Error("old join failed"))
      }
      await expect(joining).resolves.toBeNull()
    })

    expect(toast.error).not.toHaveBeenCalled()
    expect(fetchQueue).not.toHaveBeenCalled()
    expect(next.result.current.view.kind).toBe("join")
    expect(next.result.current.joining).toBe(false)
  })
})
