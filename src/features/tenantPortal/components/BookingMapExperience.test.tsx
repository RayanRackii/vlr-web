import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TenantTimeZoneContext } from "@/contexts/TenantTimeZoneContext"
import { BookingMapExperience } from "@/features/tenantPortal/components/BookingMapExperience"
import { fetchDailyAvailability } from "@/features/rentals/services/resourceVisualService"
import type { PortalRentalAsset } from "@/features/tenantPortal/services/tenantPortalService"

const RENTAL_ID = "11111111-1111-4111-8111-111111111111"
const ASSET_ID = "22222222-2222-4222-8222-222222222222"
const UNIT_ID = "33333333-3333-4333-8333-333333333333"
const MAP_ID = "44444444-4444-4444-8444-444444444444"

vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  fetchPublicBookingMaps: vi.fn(async () => ({
    maps: [{ id: MAP_ID, unitId: null, name: "Club", aspectRatio: 1, widthPercent: 100, sortOrder: 0, version: 1 }],
    defaultLayoutId: MAP_ID,
    settings: { availableColor: "#000000", takenColor: "#000000", unavailableColor: "#000000", selectedColor: "#000000", showPriceOnBlock: true, timeFilterMode: "Periods", defaultView: "List", version: 1 },
  })),
  fetchPublicBookingMap: vi.fn(async () => ({
    id: MAP_ID, unitId: null, name: "Club", aspectRatio: 1, widthPercent: 100, version: 1,
    items: [{ id: MAP_ID, rentalAssetId: RENTAL_ID, assetName: "Raquete", xPercent: 0, yPercent: 0, widthPercent: 20, heightPercent: 20, zIndex: 1, visualTemplateRevisionId: null, capacityPeople: null }],
    decorations: [], visualRevisions: [],
  })),
  fetchDailyAvailability: vi.fn(async () => ({
    date: "2026-10-25", timeZone: "America/Sao_Paulo", serverNow: "2026-10-25T12:00:00Z", quoteExpiresAt: "2099-10-25T12:00:00Z", currency: "BRL",
    resources: [{ rentalAssetId: RENTAL_ID, assetId: ASSET_ID, unitId: UNIT_ID, name: "Raquete", type: "Good", totalQuantity: 4, requiresDeposit: false, queueEnabled: false, effectiveMaxAdvanceBookingDays: null, windows: [{ slotId: null, startTime: "08:00:00", endTime: "09:00:00", isDerived: true, state: "Available", reasonCode: null, availableQuantity: 3, totalAmount: 20 }] }],
  })),
  visualArtUrl: vi.fn(),
}))

vi.mock("@/features/tenantPortal/hooks/useReservationQueue", () => ({ useReservationQueue: () => ({ canReserve: true, view: { kind: "hidden" }, applyBookingError: () => false }) }))
vi.mock("@/features/tenantPortal/hooks/useBookingIdleTimeout", () => ({ useBookingIdleTimeout: () => undefined }))

describe("BookingMapExperience", () => {
  it.each([
    ["Hour", "R$ 60,00/hora"],
    ["Slot", "R$ 120,00/horário"],
    ["Day", "R$ 120,00/dia"],
    ["Fixed", "R$ 120,00 fixo"],
    [null, "R$ 60,00/hora"],
    [undefined, "R$ 60,00/hora"],
  ] as const)("shows the quoted %s unit for a two-hour window", async (pricingUnit, expected) => {
    const current = await fetchDailyAvailability("ficc", "2026-10-25", [RENTAL_ID])
    vi.mocked(fetchDailyAvailability).mockResolvedValueOnce({
      ...current,
      resources: current.resources.map((resource) => ({ ...resource, windows: resource.windows.map((window) => ({ ...window, endTime: "10:00:00", totalAmount: 120, pricingUnit })) })),
    })
    const user = userEvent.setup()
    render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><BookingMapExperience subdomain="ficc" locale="pt-BR" initialDate="2026-10-25" onUnavailable={vi.fn()} /></TenantTimeZoneContext.Provider>)
    await user.click(await screen.findByRole("button", { name: "Mapa" }))
    expect(await screen.findByRole("button", { name: "Raquete" })).toHaveTextContent(expected)
  })

  it("shows the quoted hourly price and remaining units on a multi-unit tile", async () => {
    const user = userEvent.setup()
    render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><BookingMapExperience subdomain="ficc" locale="pt-BR" initialDate="2026-10-25" onUnavailable={vi.fn()} /></TenantTimeZoneContext.Provider>)

    await user.click(await screen.findByRole("button", { name: "Mapa" }))
    const tile = await screen.findByRole("button", { name: "Raquete" })
    expect(tile).toHaveTextContent("Raquete · R$ 20,00/hora · 3 de 4 disponíveis")
  })

  it("warns when the chosen slot starts inside the resource's cancellation cutoff", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"))
    vi.mocked(fetchDailyAvailability).mockResolvedValueOnce({
      date: "2026-10-25", timeZone: "America/Sao_Paulo", serverNow: "2026-10-25T12:00:00Z", quoteExpiresAt: "2099-10-25T12:00:00Z", currency: "BRL",
      resources: [{ rentalAssetId: RENTAL_ID, assetId: ASSET_ID, unitId: UNIT_ID, name: "Raquete", type: "Location", totalQuantity: 1, requiresDeposit: false, queueEnabled: false, effectiveMaxAdvanceBookingDays: null, windows: [{ slotId: null, startTime: "14:00:00", endTime: "15:00:00", isDerived: true, state: "Available", reasonCode: null, availableQuantity: 1, totalAmount: 50 }] }],
    })
    const scopedAssets: PortalRentalAsset[] = [{
      id: RENTAL_ID,
      assetId: ASSET_ID,
      tenantId: UNIT_ID,
      unitId: UNIT_ID,
      name: "Raquete",
      type: "Location",
      totalQuantity: 1,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      effectiveCancelCutoffHours: 24,
    } as PortalRentalAsset]
    const user = userEvent.setup()
    render(<TenantTimeZoneContext.Provider value="America/Sao_Paulo"><BookingMapExperience subdomain="ficc" locale="pt-BR" initialDate="2026-10-25" onUnavailable={vi.fn()} scopedAssets={scopedAssets} /></TenantTimeZoneContext.Provider>)

    await user.click(await screen.findByRole("button", { name: "Mapa" }))
    await user.click(await screen.findByRole("button", { name: "Raquete" }))
    await user.click(await screen.findByRole("button", { name: "14:00–15:00 · R$ 50,00" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Atenção: esta reserva começa dentro do prazo de cancelamento de 24 horas e não poderá ser cancelada depois de confirmada.",
    )
    vi.useRealTimers()
  })
})
