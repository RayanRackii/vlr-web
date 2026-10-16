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
    },
  }
})

import {
  bookPortalSlot,
  createPortalReservation,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  BOOKING_HORIZON_EXCEEDED,
  DAILY_BOOKING_LIMIT_REACHED,
  PortalBookingError,
} from "@/features/tenantPortal/lib/portalBookingError"

const customerPost = vi.mocked(customerApi.post)

const reservationPayload = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  customerName: "Ana Souza",
  customerWhatsApp: "+5511999999999",
  startDateTime: "2026-09-08T13:00:00.000Z",
  endDateTime: "2026-09-08T14:00:00.000Z",
  status: "Confirmed",
  totalAmount: 80,
  depositPaid: 0,
  createdAt: "2026-09-06T12:00:00.000Z",
  items: [
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      rentalAssetId: "11111111-1111-4111-8111-111111111111",
      assetName: "Sala 1",
      quantity: 1,
      unitPrice: 80,
      subTotal: 80,
    },
  ],
}

function axiosError(status: number, data: unknown): AxiosError {
  return new AxiosError("boom", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data,
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

describe("customer booking requests", () => {
  beforeEach(() => {
    customerPost.mockReset()
  })

  it("books a slot and creates a reservation", async () => {
    customerPost.mockResolvedValue({ data: reservationPayload })

    await expect(
      bookPortalSlot({
        slotId: "11111111-1111-4111-8111-111111111111",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ).resolves.toMatchObject({ id: reservationPayload.id })
    expect(customerPost).toHaveBeenCalledWith("/api/schedule/slots/book", {
      slotId: "11111111-1111-4111-8111-111111111111",
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      quantity: 1,
    })

    customerPost.mockResolvedValue({ data: reservationPayload })
    await expect(
      createPortalReservation({
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        date: "2026-09-08",
        startTime: "10:00",
        endTime: "11:00",
        items: [
          {
            assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            quantity: 1,
          },
        ],
      }),
    ).resolves.toMatchObject({ status: "Confirmed" })
    expect(customerPost).toHaveBeenCalledWith("/api/reservations", {
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2026-09-08",
      startTime: "10:00",
      endTime: "11:00",
      items: [
        {
          assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          quantity: 1,
        },
      ],
    })
  })

  it("preserves DAILY_BOOKING_LIMIT_REACHED on both booking posts", async () => {
    const payload = {
      error: "Limite de 3 reservas ativas por dia atingido.",
      code: DAILY_BOOKING_LIMIT_REACHED,
    }
    customerPost.mockRejectedValue(axiosError(409, payload))

    await expect(
      bookPortalSlot({
        slotId: "11111111-1111-4111-8111-111111111111",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ).rejects.toMatchObject({
      name: "PortalBookingError",
      status: 409,
      code: DAILY_BOOKING_LIMIT_REACHED,
      message: payload.error,
    })

    customerPost.mockRejectedValue(axiosError(409, payload))
    const created = createPortalReservation({
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2026-09-08",
      startTime: "10:00",
      endTime: "11:00",
      items: [
        { assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 1 },
      ],
    })
    await expect(created).rejects.toBeInstanceOf(PortalBookingError)
    await expect(created).rejects.toMatchObject({
      code: DAILY_BOOKING_LIMIT_REACHED,
      status: 409,
    })
  })

  it("keeps the booking horizon code on a rejected book", async () => {
    customerPost.mockRejectedValue(
      axiosError(400, {
        error: "A data solicitada está além do horizonte de reserva.",
        code: "booking_horizon_exceeded",
      }),
    )

    await expect(
      bookPortalSlot({
        slotId: "11111111-1111-4111-8111-111111111111",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ).rejects.toMatchObject({
      code: BOOKING_HORIZON_EXCEEDED,
      status: 400,
      message: "A data solicitada está além do horizonte de reserva.",
    })
  })

  it("falls back when the booking payload has no error string", async () => {
    customerPost.mockRejectedValue(axiosError(500, { unexpected: true }))

    await expect(
      bookPortalSlot({
        slotId: "11111111-1111-4111-8111-111111111111",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ).rejects.toThrow(i18n.t("apiErrors.bookSlot"))
  })
})
