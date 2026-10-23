import { beforeEach, describe, expect, it, vi } from "vitest"
import { api, publicApi } from "@/lib/api"
import adminTemplatesFixture from "@/features/rentals/schemas/__fixtures__/admin-visual-templates.json"
import dailyAvailabilityFixture from "@/features/rentals/schemas/__fixtures__/daily-availability.json"
import publicMapFixture from "@/features/rentals/schemas/__fixtures__/public-booking-map.json"
import publicMapsFixture from "@/features/rentals/schemas/__fixtures__/public-booking-maps.json"
import tagsFixture from "@/features/rentals/schemas/__fixtures__/visual-tags.json"

vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, publicApi: { get: vi.fn() }, getAxiosErrorPayload: vi.fn(), parseApiError: vi.fn((_payload: unknown, fallback: string) => fallback) }))

const ID = "11111111-1111-4111-8111-111111111111"
const tag = { id: ID, slug: "sports", kind: "Segment", facet: "segment", nameI18n: { "pt-BR": "Esportes" }, isActive: true, sortOrder: 0 }

describe("resource visual service", () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); vi.mocked(api.put).mockReset(); vi.mocked(api.post).mockReset(); vi.mocked(publicApi.get).mockReset() })
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
  it("accepts the public composition contract without admin-only fields", async () => {
    vi.mocked(publicApi.get).mockResolvedValue({ data: { id: ID, unitId: null, name: "Public", aspectRatio: 1.6, widthPercent: 100, version: 2, items: [], decorations: [], visualRevisions: [] } })
    const { fetchPublicBookingMap } = await import("@/features/rentals/services/resourceVisualService")
    await expect(fetchPublicBookingMap("demo", ID)).resolves.toMatchObject({ id: ID, name: "Public" })
  })
  it("parses a published revision instead of a template", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id: ID, templateId: ID, revisionNo: 1, status: "Published", viewBox: "0 0 10 10", aspectRatio: 1, defaultColor: "#000000", defaultIcon: "x", suggestedSlotMinutes: null, suggestedCapacityPeople: null, artSha256: "hash", artUrl: null, version: 2 } })
    const { publishVisualRevision } = await import("@/features/rentals/services/resourceVisualService")
    await expect(publishVisualRevision(ID, ID)).resolves.toMatchObject({ status: "Published" })
  })

  it("resolves admin template and tag list calls with representative API fixtures", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: adminTemplatesFixture }).mockResolvedValueOnce({ data: tagsFixture })
    const { listAdminVisualTemplates, listVisualTags } = await import("@/features/rentals/services/resourceVisualService")
    await expect(listAdminVisualTemplates()).resolves.toMatchObject({ items: [{ id: "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b" }] })
    await expect(listVisualTags()).resolves.toMatchObject([{ facet: "segment" }, { facet: "floor" }, { facet: "sport" }])
  })

  it("resolves public map list and map calls with representative API fixtures", async () => {
    vi.mocked(publicApi.get).mockResolvedValueOnce({ data: publicMapsFixture }).mockResolvedValueOnce({ data: publicMapFixture })
    const { fetchPublicBookingMaps, fetchPublicBookingMap } = await import("@/features/rentals/services/resourceVisualService")
    await expect(fetchPublicBookingMaps("demo")).resolves.toMatchObject({ maps: [{ id: "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b" }] })
    await expect(fetchPublicBookingMap("demo", "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b")).resolves.toMatchObject({ visualRevisions: [{ defaultColor: "#DCC08B" }] })
  })

  it("resolves daily availability with deterministic GUID identifiers", async () => {
    vi.mocked(publicApi.get).mockResolvedValue({ data: dailyAvailabilityFixture })
    const { fetchDailyAvailability } = await import("@/features/rentals/services/resourceVisualService")
    await expect(fetchDailyAvailability("demo", "2026-10-22", [])).resolves.toMatchObject({ resources: [{ rentalAssetId: "3f2a9c1e-7b4d-1a2b-ff00-9c8d7e6f5a4b" }] })
  })
})
