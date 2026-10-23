import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"
import type { MapComposition } from "@/features/rentals/services/resourceVisualService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

let isTrialReadOnly = false

vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({ isTrialReadOnly }),
}))
vi.mock("@/features/admin/hooks/usePlatformAdmin", () => ({
  useIsPlatformAdmin: () => false,
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
const REVISION_ID = "33333333-3333-4333-8333-333333333333"
const layout = { id: ID, unitId: null, name: "Mapa A", isActive: true, aspectRatio: 2, widthPercent: 100, items: [{ id: ID, rentalAssetId: ASSET_ID, assetName: "Sala A", xPercent: 4, yPercent: 4, widthPercent: 20, heightPercent: 10, zIndex: 0 }] }
const composition: MapComposition = { ...layout, sortOrder: 0, version: 1, decorations: [], items: [{ ...layout.items[0], rotation: 0, lockAspectRatio: true, visualTemplateRevisionId: null, capacityPeople: null }] }

function prepare(existing = false, loadedComposition = composition) {
  vi.mocked(layoutService.listRentalLayouts).mockResolvedValue(existing ? [layout] : [])
  vi.mocked(scheduleService.listAdminRentalAssets).mockResolvedValue([{ id: ASSET_ID, assetId: ID, name: "Sala A", isActive: true, requiresDeposit: true, schedulePolicy: "SlotGrid", unitId: ID, type: "Location", totalQuantity: 1, queueEnabled: false }])
  vi.mocked(visualService.listVisualTemplates).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, filterSemantics: "segments" })
  vi.mocked(visualService.getComposition).mockResolvedValue(loadedComposition)
  vi.mocked(visualService.getBookingMapSettings).mockRejectedValue(new Error("not available"))
}

function renderPage() {
  return render(
    <TestPermissionProvider>
      <RentalLayoutsPage />
    </TestPermissionProvider>,
  )
}

describe("RentalLayoutsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTrialReadOnly = false
  })

  it("blocks the first step until a space is selected, then follows the wizard", async () => {
    prepare()
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Novo layout" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos um espaço")
    await user.click(screen.getByRole("checkbox", { name: /Sala A/ }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(screen.getByRole("heading", { name: "Tipo e modelo visual" })).toBeInTheDocument()
  })

  it("opens an existing layout directly on the map step", async () => {
    prepare(true)
    renderPage()
    expect(await screen.findByRole("heading", { name: "Posicione os blocos" })).toBeInTheDocument()
    expect(screen.getByTestId("layout-canvas")).toBeInTheDocument()
  })

  it("persists an explicit no-template selection instead of restoring the original template", async () => {
    const templateComposition = { ...composition, items: [{ ...composition.items[0], visualTemplateRevisionId: REVISION_ID }] }
    prepare(true, templateComposition)
    vi.mocked(visualService.listVisualTemplates).mockResolvedValue({
      items: [{ id: ID, slug: "modelo-a", nameI18n: { "pt-BR": "Modelo A" }, descriptionI18n: {}, isActive: true, sortOrder: 0, version: 1, tags: [], publishedRevision: { id: REVISION_ID, templateId: ID, revisionNo: 1, status: "Published", viewBox: "0 0 1 1", aspectRatio: 1, defaultColor: "#000000", defaultIcon: "", suggestedSlotMinutes: null, suggestedCapacityPeople: null, artSha256: "", artUrl: null, version: 1 } }],
      total: 1, page: 1, pageSize: 20, filterSemantics: "segments",
    })
    vi.mocked(visualService.saveComposition).mockResolvedValue(templateComposition)
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Voltar" }))
    await user.click(screen.getByRole("combobox", { name: "Sala A" }))
    await user.click(await screen.findByRole("option", { name: "Sem modelo" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Salvar layout" }))

    expect(visualService.saveComposition).toHaveBeenCalledWith(ID, expect.objectContaining({
      items: [expect.objectContaining({ visualTemplateRevisionId: null })],
    }))
  })

  it("clears the editor when deleting the last layout", async () => {
    prepare(true)
    vi.mocked(layoutService.listRentalLayouts).mockResolvedValueOnce([layout]).mockResolvedValueOnce([])
    vi.mocked(layoutService.deleteRentalLayout).mockResolvedValue()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Excluir" }))
    expect(await screen.findByText("Crie um layout para posicionar os espaços no mapa do portal.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Salvar layout" })).not.toBeInTheDocument()
  })

  it("rejects a final save without placements with the translated validation error", async () => {
    prepare(true, { ...composition, items: [] })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Continuar" }))
    await user.click(screen.getByRole("button", { name: "Salvar layout" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos um espaço para continuar.")
    expect(visualService.saveComposition).not.toHaveBeenCalled()
  })

  it("disables read-only booking-map controls", async () => {
    isTrialReadOnly = true
    prepare(true)
    vi.mocked(visualService.getBookingMapSettings).mockResolvedValue({ availableColor: "#000000", takenColor: "#111111", unavailableColor: "#222222", selectedColor: "#333333", showPriceOnBlock: true, timeFilterMode: "Periods", defaultView: "Map", defaultLayoutId: null, version: 1 })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText("Avançado"))
    expect(screen.getByRole("checkbox", { name: "Exibir preço no bloco" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Definir mapa padrão" })).toBeDisabled()
  })
})
