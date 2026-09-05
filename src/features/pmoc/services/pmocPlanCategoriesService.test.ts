import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn(),
  isAxiosError: vi.fn(() => false),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const apiGet = vi.mocked(api.get)

const category = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Split",
}

describe("pmocPlanCategoriesService", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockResolvedValue({ data: [category] })
  })

  it("GETs /api/maintenance-plans/asset-categories, not /api/asset-categories", async () => {
    const { listPlanAssetCategories } = await import(
      "@/features/pmoc/services/pmocPlanCategoriesService"
    )

    const result = await listPlanAssetCategories()

    expect(apiGet).toHaveBeenCalledWith("/api/maintenance-plans/asset-categories")
    expect(apiGet).not.toHaveBeenCalledWith("/api/asset-categories")
    expect(result).toEqual([category])
  })
})
