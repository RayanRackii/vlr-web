import { beforeEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import { bulkApplyAssetPricings, createAssetPricing, getAssetPricings, rentalPricingSchema, updateAssetPricing } from "./rentalPricingService"

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  isAxiosError: () => false,
  getAxiosErrorPayload: vi.fn(),
  parseApiError: vi.fn(),
}))

const ID = "11111111-1111-4111-8111-111111111111"
const row = { id: ID, tenantId: ID, assetId: ID, rentalAssetId: ID, dayOfWeek: "Monday", startTime: "08:00", endTime: "10:00", pricePerHour: 45, requiresDeposit: false, depositPercentage: 0, createdAt: "2026-10-25T00:00:00Z" }

describe("rental pricing API", () => {
  beforeEach(() => vi.clearAllMocks())

  it("defaults legacy pricing rows to Hour", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [row] })
    await expect(getAssetPricings(ID)).resolves.toMatchObject([{ pricingUnit: "Hour" }])
  })

  it("omits the unit on update when it is unchanged", async () => {
    const current = rentalPricingSchema.parse({ ...row, pricingUnit: "Slot" })
    vi.mocked(api.put).mockResolvedValue({ data: { ...current, pricePerHour: 50 } })
    await updateAssetPricing(ID, current, { ...current, pricePerHour: 50 })
    const payload = vi.mocked(api.put).mock.calls[0]?.[1]
    expect(payload).toMatchObject({ pricePerHour: 50 })
    expect(payload).not.toHaveProperty("pricingUnit")
  })

  it("sends a changed unit on update", async () => {
    const current = rentalPricingSchema.parse({ ...row, pricingUnit: "Slot" })
    vi.mocked(api.put).mockResolvedValue({ data: { ...current, pricingUnit: "Fixed" } })
    await updateAssetPricing(ID, current, { ...current, pricingUnit: "Fixed" })
    expect(vi.mocked(api.put).mock.calls[0]?.[1]).toMatchObject({ pricingUnit: "Fixed" })
  })

  it.each(["Hour", "Slot", "Day", "Fixed"] as const)("sends %s on create and bulk", async (pricingUnit) => {
    const input = rentalPricingSchema.parse({ ...row, pricingUnit })
    vi.mocked(api.post).mockResolvedValueOnce({ data: input }).mockResolvedValueOnce({ data: { appliedAssetCount: 1, pricingsCreated: 1 } })
    await expect(createAssetPricing(ID, input)).resolves.toMatchObject({ pricingUnit })
    await bulkApplyAssetPricings({ assetIds: [ID], pricings: [input], replace: true })
    expect(vi.mocked(api.post).mock.calls[0]?.[1]).toMatchObject({ pricingUnit })
    expect(vi.mocked(api.post).mock.calls[1]?.[1]).toMatchObject({ pricings: [{ pricingUnit }] })
  })

  it.each([null, undefined])("keeps the current unit when update receives %s", async (pricingUnit) => {
    const current = rentalPricingSchema.parse({ ...row, pricingUnit: "Day" })
    vi.mocked(api.put).mockResolvedValue({ data: current })
    await updateAssetPricing(ID, current, { ...current, pricingUnit })
    expect(vi.mocked(api.put).mock.calls[0]?.[1]).not.toHaveProperty("pricingUnit")
  })
})
