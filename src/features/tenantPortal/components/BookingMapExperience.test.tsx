import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BookingMapExperience } from "@/features/tenantPortal/components/BookingMapExperience"

const ID = "11111111-1111-4111-8111-111111111111"
const ASSET = "22222222-2222-4222-8222-222222222222"
const UNIT = "33333333-3333-4333-8333-333333333333"
vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  fetchPublicBookingMaps: vi.fn(async () => ({ maps: [{ id: ID, unitId: UNIT, name: "Mapa", aspectRatio: 1.6, widthPercent: 100, sortOrder: 0, version: 1 }], defaultLayoutId: ID, settings: { defaultView: "Map" } })),
  fetchPublicBookingMap: vi.fn(async () => ({ id: ID, unitId: UNIT, name: "Mapa", aspectRatio: 1.6, widthPercent: 100, version: 1, decorations: [], visualRevisions: [], items: [{ id: ID, rentalAssetId: ID, assetName: "Sala A", xPercent: 0, yPercent: 0, widthPercent: 50, heightPercent: 50, zIndex: 1, rotation: 0, lockAspectRatio: true, visualTemplateRevisionId: null, capacityPeople: null }] })),
  fetchDailyAvailability: vi.fn(async () => ({ date: "2026-10-21", timeZone: "America/Sao_Paulo", serverNow: "2030-10-21T12:00:00Z", quoteExpiresAt: "2030-10-21T13:00:00Z", currency: "BRL", resources: [{ rentalAssetId: ID, assetId: ASSET, unitId: UNIT, name: "Sala A", type: "Location", totalQuantity: 1, requiresDeposit: false, queueEnabled: false, effectiveMaxAdvanceBookingDays: null, windows: [{ slotId: null, startTime: "08:00", endTime: "09:00", isDerived: true, state: "Available", reasonCode: null, availableQuantity: 1, totalAmount: 50 }] }] })),
  visualArtUrl: vi.fn(),
}))
vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({ createPortalReservation: vi.fn(async () => ({})), bookPortalSlot: vi.fn(async () => ({ })), isLocationQueueEnabled: () => false }))
vi.mock("@/features/tenantPortal/hooks/useReservationQueue", () => ({ useReservationQueue: () => ({ canReserve: true, applyBookingError: () => false, view: { kind: "hidden" }, explanation: null, joining: false }) }))

describe("BookingMapExperience", () => {
  it("opens the panel, selects a valid time, and forwards the quoted total", async () => {
    render(<BookingMapExperience subdomain="demo" locale="pt-BR" onUnavailable={vi.fn()} />)
    const resource = await screen.findByRole("button", { name: /Sala A/i })
    fireEvent.click(resource)
    const time = await screen.findByRole("button", { name: /08:00/i })
    fireEvent.click(time)
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }))
    const { createPortalReservation } = await import("@/features/tenantPortal/services/tenantPortalService")
    await waitFor(() => expect(createPortalReservation).toHaveBeenCalledWith(expect.objectContaining({ expectedTotalAmount: 50, items: [{ assetId: ASSET, quantity: 1 }] })))
  })
})
