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

const catalogFamily = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "spaces",
  label: "Espaços",
  fields: [],
  sortOrder: 0,
  isActive: true,
}

const apiGet = vi.mocked(api.get)

describe("assetFamiliesService catalog URLs", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockResolvedValue({ data: [catalogFamily] })
  })

  it("listAdminAssetFamilyCatalog GETs /api/admin/asset-families", async () => {
    const { listAdminAssetFamilyCatalog } = await import(
      "@/features/assets/services/assetFamiliesService"
    )

    const result = await listAdminAssetFamilyCatalog()

    expect(apiGet).toHaveBeenCalledWith("/api/admin/asset-families")
    expect(result).toEqual([catalogFamily])
  })

  it("listAssetFamilyCatalog GETs /api/asset-families", async () => {
    const { listAssetFamilyCatalog } = await import(
      "@/features/assets/services/assetFamiliesService"
    )

    const result = await listAssetFamilyCatalog()

    expect(apiGet).toHaveBeenCalledWith("/api/asset-families")
    expect(result).toEqual([catalogFamily])
  })

  it("listActiveAssetFamilies GETs /api/asset-families/active", async () => {
    const { listActiveAssetFamilies } = await import(
      "@/features/assets/services/assetFamiliesService"
    )

    const result = await listActiveAssetFamilies()

    expect(apiGet).toHaveBeenCalledWith("/api/asset-families/active")
    expect(result).toEqual([catalogFamily])
  })
})
