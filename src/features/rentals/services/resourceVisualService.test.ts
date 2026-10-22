import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, publicApi } from "@/lib/api"

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), put: vi.fn() }, publicApi: { get: vi.fn() }, getAxiosErrorPayload: vi.fn(), parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback) }))

const ID = "11111111-1111-4111-8111-111111111111"
const tag = { id: ID, slug: "sports", kind: "Segment", facet: "segment", nameI18n: { "pt-BR": "Esportes" }, isActive: true, sortOrder: 0 }

describe("resource visual service", () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.put).mockReset(); vi.mocked(publicApi.get).mockReset() })
  it("uses the picker filters with bracketed repeated ids", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 30, filterSemantics: "x" } })
    const { listVisualTemplates } = await import("@/features/rentals/services/resourceVisualService")
    await listVisualTemplates({ search: "room", tagIds: [ID], allSegments: true })
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("tagIds%5B%5D="))
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("allSegments=true"))
  })
  it("reads public maps and validates their map settings", async () => {
    vi.mocked(publicApi.get).mockResolvedValue({ data: { maps: [], defaultLayoutId: null, settings: { availableColor: "#00AA00", takenColor: "#AA0000", unavailableColor: "#777777", selectedColor: "#0000AA", showPriceOnBlock: true, timeFilterMode: "Periods", defaultView: "Map", defaultLayoutId: null, version: 0 } } })
    const { fetchPublicBookingMaps } = await import("@/features/rentals/services/resourceVisualService")
    await expect(fetchPublicBookingMaps("demo")).resolves.toMatchObject({ maps: [] })
    expect(publicApi.get).toHaveBeenCalledWith("/api/public/tenants/demo/booking-maps")
  })
  it("writes tenant segments to the explicit platform tenant route", async () => {
    vi.mocked(api.put).mockResolvedValue({ data: [tag] })
    const { replaceTenantSegments } = await import("@/features/rentals/services/resourceVisualService")
    await replaceTenantSegments(ID, [ID])
    expect(api.put).toHaveBeenCalledWith(`/api/admin/tenants/${ID}/resource-segments`, { segmentIds: [ID] })
  })
})
