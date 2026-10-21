import { beforeEach, describe, expect, it, vi } from "vitest"

import { publicApi } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, publicApi: { get: vi.fn() } }
})

import { fetchPortalDailyAvailability } from "@/features/tenantPortal/services/tenantPortalService"

const publicGet = vi.mocked(publicApi.get)
const fixture = {
  date: "2026-10-21", timeZone: "America/Sao_Paulo", serverNow: "2026-10-21T15:00:00+00:00", quoteExpiresAt: "2026-10-21T15:01:00+00:00", currency: "BRL",
  resources: [{ rentalAssetId: "00000000-0000-4000-8000-000000000001", assetId: "00000000-0000-4000-8000-000000000011", unitId: "00000000-0000-4000-8000-000000000099", name: "Resource 1", type: "Good", totalQuantity: 5, requiresDeposit: false, queueEnabled: false, effectiveMaxAdvanceBookingDays: null, windows: [{ slotId: null, startTime: "13:00:00", endTime: "14:00:00", isDerived: true, state: "Available", reasonCode: null, availableQuantity: 5, totalAmount: 0 }] }],
}

describe("daily availability contract", () => {
  beforeEach(() => publicGet.mockReset())
  it("validates the API fixture and keeps zero as a valid price", async () => {
    publicGet.mockResolvedValue({ data: fixture })
    await expect(fetchPortalDailyAvailability("ficc", fixture.date)).resolves.toMatchObject({ currency: "BRL", resources: [{ windows: [{ totalAmount: 0 }] }] })
    expect(publicGet).toHaveBeenCalledWith(`/api/public/tenants/ficc/availability/days/${fixture.date}`, { params: { quantity: 1 }, headers: { "Cache-Control": "no-cache" } })
  })
  it("rejects a payload outside the public availability contract", async () => {
    publicGet.mockResolvedValue({ data: { ...fixture, currency: "USD" } })
    await expect(fetchPortalDailyAvailability("ficc", fixture.date)).rejects.toThrow()
  })

  it("enforces documented formats, reason codes, and response limits", async () => {
    publicGet.mockResolvedValue({
      data: {
        ...fixture,
        date: "2026/10/21",
        resources: [{
          ...fixture.resources[0],
          windows: [{ ...fixture.resources[0].windows[0], startTime: "13:00", reasonCode: "private reason" }],
        }],
      },
    })
    await expect(fetchPortalDailyAvailability("ficc", fixture.date)).rejects.toThrow()

    publicGet.mockResolvedValue({
      data: { ...fixture, resources: Array.from({ length: 101 }, () => fixture.resources[0]) },
    })
    await expect(fetchPortalDailyAvailability("ficc", fixture.date)).rejects.toThrow()
  })
})
