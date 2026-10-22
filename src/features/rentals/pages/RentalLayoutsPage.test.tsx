import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({ isTrialReadOnly: false }),
}))
vi.mock("@/features/rentals/components/layout/LayoutCanvasBoard", () => ({
  LayoutCanvasBoard: () => <div data-testid="layout-canvas" />,
}))
vi.mock("@/features/rentals/services/rentalLayoutService", () => ({
  listRentalLayouts: vi.fn(), createRentalLayout: vi.fn(), deleteRentalLayout: vi.fn(),
}))
vi.mock("@/features/rentals/services/scheduleService", () => ({ listAdminRentalAssets: vi.fn() }))
vi.mock("@/features/rentals/services/resourceVisualService", () => ({
  listVisualTemplates: vi.fn(), getComposition: vi.fn(), getBookingMapSettings: vi.fn(), saveBookingMapSettings: vi.fn(), saveComposition: vi.fn(),
}))

const layoutService = await import("@/features/rentals/services/rentalLayoutService")
const scheduleService = await import("@/features/rentals/services/scheduleService")
const visualService = await import("@/features/rentals/services/resourceVisualService")

const ID = "11111111-1111-4111-8111-111111111111"
const ASSET_ID = "22222222-2222-4222-8222-222222222222"
const layout = { id: ID, unitId: null, name: "Mapa A", isActive: true, aspectRatio: 2, widthPercent: 100, items: [{ id: ID, rentalAssetId: ASSET_ID, assetName: "Sala A", xPercent: 4, yPercent: 4, widthPercent: 20, heightPercent: 10, zIndex: 0 }] }
const composition = { ...layout, sortOrder: 0, version: 1, decorations: [], items: [{ ...layout.items[0], rotation: 0, lockAspectRatio: true, visualTemplateRevisionId: null, capacityPeople: null }] }

function prepare(existing = false) {
  vi.mocked(layoutService.listRentalLayouts).mockResolvedValue(existing ? [layout] : [])
  vi.mocked(scheduleService.listAdminRentalAssets).mockResolvedValue([{ id: ASSET_ID, assetId: ID, name: "Sala A", isActive: true, requiresDeposit: true, schedulePolicy: "SlotGrid", unitId: ID, type: "Location", totalQuantity: 1, queueEnabled: false }])
  vi.mocked(visualService.listVisualTemplates).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, filterSemantics: "segments" })
  vi.mocked(visualService.getComposition).mockResolvedValue(composition)
  vi.mocked(visualService.getBookingMapSettings).mockRejectedValue(new Error("not available"))
}

describe("RentalLayoutsPage", () => {
  it("blocks the first step until a space is selected, then follows the wizard", async () => {
    prepare()
    const user = userEvent.setup()
    render(<RentalLayoutsPage />)
    await user.click(await screen.findByRole("button", { name: "Novo layout" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos um espaço")
    await user.click(screen.getByRole("checkbox", { name: /Sala A/ }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("heading", { name: "Tipo e modelo visual" })).toBeInTheDocument()
  })

  it("opens an existing layout directly on the map step", async () => {
    prepare(true)
    render(<RentalLayoutsPage />)
    expect(await screen.findByRole("heading", { name: "Posicione os blocos" })).toBeInTheDocument()
    expect(screen.getByTestId("layout-canvas")).toBeInTheDocument()
  })
})
