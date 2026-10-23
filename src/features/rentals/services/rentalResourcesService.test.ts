import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn(),
  isAxiosError: vi.fn(() => false),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const FAMILY_ID = "11111111-1111-4111-8111-111111111111"
const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const RENTAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ASSET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

const category = { id: CATEGORY_ID, name: "Quadra" }

const family = {
  id: FAMILY_ID,
  key: "spaces",
  label: "Espaços",
  fields: [],
  sortOrder: 0,
  isActive: true,
}

const createBody = {
  name: "Quadra 1",
  unitId: UNIT_ID,
  categoryId: CATEGORY_ID,
  familyId: FAMILY_ID,
  rentalType: "Location" as const,
  totalQuantity: 1,
  requiresDeposit: true,
  queueEnabled: false,
  queueOpeningTime: null,
  location: "Bloco A",
}

const rentalResponse = {
  id: RENTAL_ID,
  assetId: ASSET_ID,
  tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  unitId: UNIT_ID,
  name: "Quadra 1",
  type: "Location",
  totalQuantity: 1,
  isActive: true,
  requiresDeposit: true,
  schedulePolicy: "SlotGrid",
  openTime: null,
  closeTime: null,
  allowedDurationMinutes: null,
  queueEnabled: false,
  queueOpeningTime: null,
  categoryId: CATEGORY_ID,
  categoryName: "Quadra",
  createdAt: "2026-09-04T12:00:00.000Z",
  updatedAt: null,
}

const apiGet = vi.mocked(api.get)
const apiPost = vi.mocked(api.post)
const apiPut = vi.mocked(api.put)

function calledUrls(): string[] {
  return [...apiGet.mock.calls, ...apiPost.mock.calls, ...apiPut.mock.calls]
    .map((call) => call[0])
    .filter((url): url is string => typeof url === "string")
}

function expectNoInventoryAssetUrls() {
  for (const url of calledUrls()) {
    expect(url === "/api/assets" || url.startsWith("/api/assets/")).toBe(false)
    expect(url.startsWith("/api/asset-categories")).toBe(false)
    expect(url.startsWith("/api/asset-families")).toBe(false)
  }
}

describe("rentalResourcesService catalog URLs", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiPost.mockReset()
    apiPut.mockReset()
  })

  it("lists categories from GET /api/rental-assets/categories", async () => {
    apiGet.mockResolvedValue({ data: [category] })
    const { listRentalAssetCategories } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    const result = await listRentalAssetCategories()

    expect(apiGet).toHaveBeenCalledWith("/api/rental-assets/categories")
    expect(result).toEqual([category])
    expectNoInventoryAssetUrls()
  })

  it("creates a category via POST /api/rental-assets/categories and parses its response", async () => {
    apiPost.mockResolvedValue({ data: category })
    const { createRentalCategory } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    const result = await createRentalCategory({ name: " Quadra " })

    expect(apiPost).toHaveBeenCalledWith("/api/rental-assets/categories", {
      name: "Quadra",
    })
    expect(result).toEqual(category)
    expectNoInventoryAssetUrls()
  })

  it("rejects an invalid category response", async () => {
    apiPost.mockResolvedValue({ data: { id: "not-a-uuid", name: "" } })
    const { createRentalCategory } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    await expect(createRentalCategory({ name: "Quadra" })).rejects.toThrow()
  })

  it("lists families from GET /api/rental-assets/families, not /api/asset-families", async () => {
    apiGet.mockResolvedValue({ data: [family] })
    const { listRentalAssetFamilies } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    const result = await listRentalAssetFamilies()

    expect(apiGet).toHaveBeenCalledWith("/api/rental-assets/families")
    expect(result).toEqual([family])
    expectNoInventoryAssetUrls()
  })

  it("creates a rentable via POST /api/rental-assets without a registry tag", async () => {
    apiPost.mockResolvedValue({ data: rentalResponse })
    const { createRentalAsset } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    await createRentalAsset(createBody)

    expect(apiPost).toHaveBeenCalledWith("/api/rental-assets", createBody)
    expect(apiPost.mock.calls[0]?.[1]).not.toHaveProperty("tag")
    expectNoInventoryAssetUrls()
  })

  it("updates a rentable via PUT /api/rental-assets/{rentalAssetId}, not assetId", async () => {
    apiPut.mockResolvedValue({ data: rentalResponse })
    const { updateRentalAsset } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    await updateRentalAsset(RENTAL_ID, createBody)

    expect(apiPut).toHaveBeenCalledWith(
      `/api/rental-assets/${RENTAL_ID}`,
      createBody,
    )
    expect(apiPut.mock.calls[0]?.[0]).not.toContain(ASSET_ID)
    expectNoInventoryAssetUrls()
  })

  it("sends an omitted, null, or numeric booking horizon", async () => {
    apiPost.mockResolvedValue({
      data: {
        ...rentalResponse,
        maxAdvanceBookingDays: 21,
        effectiveMaxAdvanceBookingDays: 21,
      },
    })
    apiPut.mockResolvedValue({
      data: {
        ...rentalResponse,
        maxAdvanceBookingDays: null,
        effectiveMaxAdvanceBookingDays: null,
      },
    })
    const { createRentalAsset, updateRentalAsset } = await import(
      "@/features/rentals/services/rentalResourcesService"
    )

    const created = await createRentalAsset({
      ...createBody,
      maxAdvanceBookingDays: 21,
    })
    expect(apiPost).toHaveBeenCalledWith("/api/rental-assets", {
      ...createBody,
      maxAdvanceBookingDays: 21,
    })
    expect(created.maxAdvanceBookingDays).toBe(21)
    expect(created.effectiveMaxAdvanceBookingDays).toBe(21)

    const cleared = await updateRentalAsset(RENTAL_ID, {
      ...createBody,
      maxAdvanceBookingDays: null,
    })
    expect(apiPut).toHaveBeenCalledWith(`/api/rental-assets/${RENTAL_ID}`, {
      ...createBody,
      maxAdvanceBookingDays: null,
    })
    expect(cleared.maxAdvanceBookingDays).toBeNull()
    expect(cleared.effectiveMaxAdvanceBookingDays).toBeNull()

    apiPost.mockResolvedValue({ data: rentalResponse })
    await createRentalAsset(createBody)
    expect(apiPost.mock.calls[1]?.[1]).not.toHaveProperty(
      "maxAdvanceBookingDays",
    )
  })
})
