import { beforeEach, describe, expect, it, vi } from "vitest"
import { publicApi } from "@/lib/api"
import { checkPortalAvailability } from "./tenantPortalService"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  publicApi: { get: vi.fn() },
}))

describe("portal availability pricing unit", () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(["Hour", "Slot", "Day", "Fixed", null, undefined])("preserves the quoted unit %s", async (pricingUnit) => {
    vi.mocked(publicApi.get).mockResolvedValue({ data: {
      isAvailable: true, requestedQuantity: 1, availableQuantity: 1,
      estimatedTotalAmount: 45, reason: null, pricingUnit,
    } })
    const result = await checkPortalAvailability("demo", { assetId: "11111111-1111-4111-8111-111111111111", date: "2026-10-25", startTime: "08:00", endTime: "10:00" })
    expect(result.pricingUnit).toBe(pricingUnit)
  })
})
