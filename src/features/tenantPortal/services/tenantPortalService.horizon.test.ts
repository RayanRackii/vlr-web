import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { customerApi, publicApi } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    customerApi: {
      get: vi.fn(),
      post: vi.fn(),
    },
    publicApi: {
      get: vi.fn(),
    },
  }
})

import { BOOKING_HORIZON_EXCEEDED } from "@/features/tenantPortal/lib/portalBookingError"
import {
  fetchPublicScheduleDay,
  listMyPortalReservations,
} from "@/features/tenantPortal/services/tenantPortalService"

const customerGet = vi.mocked(customerApi.get)
const publicGet = vi.mocked(publicApi.get)

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError("boom", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

const freshHeaders = {
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
}

describe("agenda reads after a booking", () => {
  beforeEach(() => {
    customerGet.mockReset()
    publicGet.mockReset()
  })

  it("asks the browser not to reuse a cached reservation list or day", async () => {
    customerGet.mockResolvedValue({ data: [] })
    publicGet.mockResolvedValue({ data: { date: "2026-10-16", slots: [] } })

    await listMyPortalReservations()
    await fetchPublicScheduleDay("ficc", "2026-10-16")

    expect(customerGet).toHaveBeenCalledWith("/api/reservations/mine", {
      headers: freshHeaders,
    })
    expect(publicGet).toHaveBeenCalledWith(
      "/api/public/tenants/ficc/schedule/days/2026-10-16",
      {
        params: undefined,
        headers: freshHeaders,
      },
    )
  })

  it("keeps the horizon code when the day is rejected", async () => {
    publicGet.mockRejectedValue(
      axiosError(400, {
        error: "A data solicitada está além do horizonte de reserva.",
        code: "booking_horizon_exceeded",
      }),
    )

    await expect(fetchPublicScheduleDay("ficc", "2099-12-31")).rejects.toMatchObject(
      {
        code: BOOKING_HORIZON_EXCEEDED,
        status: 400,
      },
    )
  })
})
