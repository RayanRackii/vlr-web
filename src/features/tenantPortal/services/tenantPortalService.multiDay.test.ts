import { beforeEach, describe, expect, it, vi } from "vitest"

import { customerApi, publicApi } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  publicApi: { get: vi.fn() },
  customerApi: { get: vi.fn(), post: vi.fn() },
}))

import {
  checkPortalAvailability,
  createPortalReservation,
} from "@/features/tenantPortal/services/tenantPortalService"

const publicGet = vi.mocked(publicApi.get)
const customerPost = vi.mocked(customerApi.post)

const reservationPayload = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  customerId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  customerName: "Ana Souza",
  customerWhatsApp: "+5511999999999",
  startDateTime: "2026-09-08T13:00:00.000Z",
  endDateTime: "2026-09-10T14:00:00.000Z",
  status: "Confirmed",
  totalAmount: 240,
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
      subTotal: 240,
    },
  ],
}

describe("portal multi-day requests", () => {
  beforeEach(() => {
    publicGet.mockReset()
    customerPost.mockReset()
  })

  it("forwards endDate to the availability check when given", async () => {
    publicGet.mockResolvedValue({ data: {
      isAvailable: true, requestedQuantity: 1, availableQuantity: 1,
      estimatedTotalAmount: 240, pricingUnit: "Day", reason: null,
    } })

    await checkPortalAvailability("demo", {
      assetId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-08",
      endDate: "2026-09-10",
      startTime: "08:00",
      endTime: "09:00",
      quantity: 1,
    })

    expect(publicGet).toHaveBeenCalledWith("/api/reservations/availability", {
      params: {
        assetId: "11111111-1111-4111-8111-111111111111",
        date: "2026-09-08",
        endDate: "2026-09-10",
        startTime: "08:00",
        endTime: "09:00",
        quantity: 1,
      },
      headers: { "X-Tenant-Subdomain": "demo" },
    })
  })

  it("omits endDate from the availability check when not given", async () => {
    publicGet.mockResolvedValue({ data: {
      isAvailable: true, requestedQuantity: 1, availableQuantity: 1,
      estimatedTotalAmount: 80, pricingUnit: "Day", reason: null,
    } })

    await checkPortalAvailability("demo", {
      assetId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-08",
      startTime: "08:00",
      endTime: "09:00",
      quantity: 1,
    })

    expect(publicGet).toHaveBeenCalledWith("/api/reservations/availability", {
      params: {
        assetId: "11111111-1111-4111-8111-111111111111",
        date: "2026-09-08",
        startTime: "08:00",
        endTime: "09:00",
        quantity: 1,
      },
      headers: { "X-Tenant-Subdomain": "demo" },
    })
  })

  it("forwards endDate to the reservation create body when given", async () => {
    customerPost.mockResolvedValue({ data: reservationPayload })

    await createPortalReservation({
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2026-09-08",
      endDate: "2026-09-10",
      startTime: "08:00",
      endTime: "09:00",
      items: [{ assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 1 }],
      expectedTotalAmount: 240,
    })

    expect(customerPost).toHaveBeenCalledWith("/api/reservations", {
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2026-09-08",
      endDate: "2026-09-10",
      startTime: "08:00",
      endTime: "09:00",
      items: [{ assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 1 }],
      expectedTotalAmount: 240,
    })
  })

  it("omits endDate from the reservation create body when not given", async () => {
    customerPost.mockResolvedValue({ data: reservationPayload })

    await createPortalReservation({
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2026-09-08",
      startTime: "08:00",
      endTime: "09:00",
      items: [{ assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 1 }],
      expectedTotalAmount: 80,
    })

    expect(customerPost).toHaveBeenCalledWith("/api/reservations", {
      unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      date: "2026-09-08",
      startTime: "08:00",
      endTime: "09:00",
      items: [{ assetId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 1 }],
      expectedTotalAmount: 80,
    })
  })
})
