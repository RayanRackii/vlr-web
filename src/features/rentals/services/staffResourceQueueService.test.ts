import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"
import { staffResourceQueuePath } from "@/features/rentals/schemas/staffResourceQueueSchemas"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, api: { get: vi.fn() } }
})

import { fetchStaffResourceQueue } from "@/features/rentals/services/staffResourceQueueService"

const apiGet = vi.mocked(api.get)
const RENTAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CUSTOMER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const TICKET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function httpError(status: number): AxiosError {
  return new AxiosError("fail", undefined, undefined, undefined, {
    status,
    data: { error: "no" },
    statusText: "no",
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  })
}

const queue = {
  rentalAssetId: RENTAL_ID,
  queueEnabled: true,
  openingDate: "2026-11-09",
  opensAt: "2026-11-09T10:00:00Z",
  waitingRoomOpensAt: "2026-11-09T09:30:00Z",
  serverNow: "2026-11-09T10:05:00Z",
  phase: "Open",
  waitingCount: 1,
  activeCount: 0,
  tickets: [{
    id: TICKET_ID,
    customerId: CUSTOMER_ID,
    customerName: "Ana",
    status: "Waiting",
    sequence: 1,
    position: 1,
    joinedAt: "2026-11-09T10:01:00Z",
    turnStartedAt: null,
    turnExpiresAt: null,
    completedReservationId: null,
  }],
}

describe("fetchStaffResourceQueue", () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it("reads the proposed staff roster for the opening date", async () => {
    apiGet.mockResolvedValue({ data: queue })
    await expect(fetchStaffResourceQueue(RENTAL_ID, "2026-11-09")).resolves.toEqual({
      status: "ready",
      queue,
    })
    expect(apiGet).toHaveBeenCalledWith(staffResourceQueuePath(RENTAL_ID, "2026-11-09"))
    expect(staffResourceQueuePath(RENTAL_ID, "2026-11-09")).toBe(
      `/api/rentals/rental-assets/${RENTAL_ID}/queue?openingDate=2026-11-09`,
    )
    expect(String(apiGet.mock.calls[0]?.[0])).not.toContain("/queue/join")
  })

  it("degrades when the endpoint is missing or the body is not the roster", async () => {
    apiGet.mockRejectedValueOnce(httpError(404))
    await expect(fetchStaffResourceQueue(RENTAL_ID)).resolves.toEqual({ status: "unavailable" })

    apiGet.mockResolvedValueOnce({ data: { myTicket: null, aheadCount: 2 } })
    await expect(fetchStaffResourceQueue(RENTAL_ID)).resolves.toEqual({ status: "unavailable" })
  })

  it("reports a permission failure without a roster", async () => {
    apiGet.mockRejectedValue(httpError(403))
    await expect(fetchStaffResourceQueue(RENTAL_ID)).resolves.toEqual({ status: "forbidden" })
  })
})
