import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  getAxiosErrorPayload: vi.fn(),
  isAxiosError: vi.fn(() => false),
  parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback),
}))

const apiGet = vi.mocked(api.get)

const registryAsset = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Split sala 1",
  tag: "AC-01",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  status: "Active",
}

describe("workOrdersService registry assets", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockResolvedValue({ data: [registryAsset] })
  })

  it("lists picker assets from GET /api/work-orders/assets, not /api/assets", async () => {
    const { listWorkOrderAssets } = await import(
      "@/features/workOrders/services/workOrdersService"
    )

    const result = await listWorkOrderAssets()

    expect(apiGet).toHaveBeenCalledWith("/api/work-orders/assets")
    expect(apiGet).not.toHaveBeenCalledWith("/api/assets")
    expect(result).toEqual([registryAsset])
  })
})
