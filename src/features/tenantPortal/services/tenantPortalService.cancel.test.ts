import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { customerApi } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    customerApi: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    },
  }
})

import { cancelMyPortalReservation } from "@/features/tenantPortal/services/tenantPortalService"

const RESERVATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const reservationPayload = {
  id: RESERVATION_ID,
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  customerName: "Ana Souza",
  customerWhatsApp: "+5511999999999",
  startDateTime: "2026-09-08T13:00:00.000Z",
  endDateTime: "2026-09-08T14:00:00.000Z",
  status: "Canceled",
  totalAmount: 80,
  depositPaid: 0,
  createdAt: "2026-09-06T12:00:00.000Z",
  items: [
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      rentalAssetId: "11111111-1111-4111-8111-111111111111",
      assetName: "Quadra 1",
      quantity: 1,
      unitPrice: 80,
      subTotal: 80,
    },
  ],
}

const customerPost = vi.mocked(customerApi.post)

function apiError(status: number, message: string): AxiosError {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: message },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("cancelMyPortalReservation", () => {
  beforeEach(() => {
    customerPost.mockReset()
  })

  it("posts to the Customer mine cancel route and returns the parsed reservation", async () => {
    customerPost.mockResolvedValue({ data: reservationPayload })

    const result = await cancelMyPortalReservation(RESERVATION_ID)

    expect(customerPost).toHaveBeenCalledWith(
      `/api/reservations/mine/${RESERVATION_ID}/cancel`,
    )
    expect(customerPost).not.toHaveBeenCalledWith(
      `/api/reservations/${RESERVATION_ID}/cancel`,
    )
    expect(result.status).toBe("Canceled")
    expect(result.id).toBe(RESERVATION_ID)
  })

  it("surfaces a 409 conflict message from the API", async () => {
    customerPost.mockRejectedValue(
      apiError(409, "Cannot cancel a reservation that has already started."),
    )

    await expect(cancelMyPortalReservation(RESERVATION_ID)).rejects.toThrow(
      "Cannot cancel a reservation that has already started.",
    )
  })

  it("surfaces a 404 not-found message from the API", async () => {
    customerPost.mockRejectedValue(apiError(404, "Reservation not found."))

    await expect(cancelMyPortalReservation(RESERVATION_ID)).rejects.toThrow(
      "Reservation not found.",
    )
  })

  it("falls back to apiErrors.cancelReservation when the payload has no error", async () => {
    customerPost.mockRejectedValue(
      new AxiosError("boom", undefined, undefined, undefined, {
        status: 500,
        statusText: "Error",
        data: { unexpected: true },
        headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
      }),
    )

    await expect(cancelMyPortalReservation(RESERVATION_ID)).rejects.toThrow(
      i18n.t("apiErrors.cancelReservation"),
    )
  })
})
