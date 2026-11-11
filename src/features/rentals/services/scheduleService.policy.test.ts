import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  }
})

import { rentalAssetSchema, updateRentalSchedulePolicy } from "@/features/rentals/services/scheduleService"

const apiPut = vi.mocked(api.put)
const rentalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const stored = {
  id: rentalId,
  assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Sala",
  isActive: true,
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  schedulePolicy: "OpenHours",
  openTime: "08:00:00",
  closeTime: "20:00:00",
  allowedDurationMinutes: "60",
  minimumBookingLeadMinutes: null,
  effectiveMinimumBookingLeadMinutes: 180,
  depositPercent: 0,
  effectiveDepositPercent: 0,
}

describe("rental schedule policy lead and deposit", () => {
  beforeEach(() => {
    apiPut.mockReset()
    apiPut.mockResolvedValue({ data: stored })
  })

  it("reads the stored override and the effective value, including zero", () => {
    expect(rentalAssetSchema.parse(stored)).toMatchObject({
      minimumBookingLeadMinutes: null,
      effectiveMinimumBookingLeadMinutes: 180,
      depositPercent: 0,
      effectiveDepositPercent: 0,
    })
    expect(rentalAssetSchema.parse({ ...stored, minimumBookingLeadMinutes: undefined, depositPercent: undefined }).depositPercent).toBeUndefined()
    expect(rentalAssetSchema.safeParse({ ...stored, minimumBookingLeadMinutes: 525601 }).success).toBe(false)
    expect(rentalAssetSchema.safeParse({ ...stored, depositPercent: 101 }).success).toBe(false)
    expect(rentalAssetSchema.safeParse({ ...stored, depositPercent: 1.5 }).success).toBe(false)
  })

  it("omits an unchanged term and sends an explicit null when it is cleared", async () => {
    await updateRentalSchedulePolicy(rentalId, {
      schedulePolicy: "OpenHours",
      openTime: "08:00:00",
      closeTime: "20:00:00",
      allowedDurationMinutes: "60",
    })
    expect(apiPut).toHaveBeenCalledWith(`/api/rental-assets/${rentalId}/schedule-policy`, {
      schedulePolicy: "OpenHours",
      openTime: "08:00:00",
      closeTime: "20:00:00",
      allowedDurationMinutes: "60",
    })

    await updateRentalSchedulePolicy(rentalId, {
      schedulePolicy: "OpenHours",
      openTime: "08:00:00",
      closeTime: "20:00:00",
      allowedDurationMinutes: "60",
      minimumBookingLeadMinutes: 0,
      depositPercent: null,
    })
    expect(apiPut).toHaveBeenLastCalledWith(`/api/rental-assets/${rentalId}/schedule-policy`, {
      schedulePolicy: "OpenHours",
      openTime: "08:00:00",
      closeTime: "20:00:00",
      allowedDurationMinutes: "60",
      minimumBookingLeadMinutes: 0,
      depositPercent: null,
    })
  })
})
