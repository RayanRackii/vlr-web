import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { ResourceAssistantPage } from "./ResourceAssistantPage"
import { useResourceWizard } from "@/features/rentals/components/resourceWizard/useResourceWizard"
import { getCatalogProductResourceRequirements, listCatalogProducts } from "@/features/catalog/services/catalogService"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

vi.mock("@/features/rentals/components/resourceWizard/useResourceWizard", () => ({ useResourceWizard: vi.fn() }))
vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogProducts: vi.fn(),
  getCatalogProductResourceRequirements: vi.fn(),
}))

const rentalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const productId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const asset = {
  id: rentalId,
  assetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "Estúdio A",
  isActive: true,
  type: "Location",
  schedulePolicy: "OpenHours",
  openTime: "08:00:00",
  closeTime: "20:00:00",
  queueEnabled: true,
  queueOpeningTime: null,
  allowedDurationMinutes: null,
  cancelCutoffHours: null,
  unitId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  totalQuantity: 1,
} as AdminRentalAsset

const savePolicy = vi.fn()
const saveQueue = vi.fn()
const saveFields = vi.fn()

function setup() {
  vi.mocked(useResourceWizard).mockReturnValue({
    loading: false,
    error: null,
    model: { asset, menuItems: [], templates: [], kinds: [], prices: [] },
    access: { assetWrite: true, scheduleRead: true, scheduleWrite: true, pricingRead: true, pricingWrite: true, pricingReplace: true },
    busy: false,
    busyAction: null,
    wizardPath: `/configuracoes/recursos/${rentalId}/assistente`,
    savePolicy,
    saveQueue,
    saveFields,
    savePrices: vi.fn(),
    publishMenu: vi.fn(),
    seedTemplates: vi.fn(),
    reload: vi.fn(),
  } as never)
  return render(
    <MemoryRouter initialEntries={[`/configuracoes/recursos/${rentalId}/passos`]}>
      <Routes>
        <Route path="/configuracoes/recursos/:id/passos" element={<ResourceAssistantPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCatalogProducts).mockResolvedValue([{ id: productId, name: "Diária", visibility: "Public" } as never])
  vi.mocked(getCatalogProductResourceRequirements).mockResolvedValue({ expectedVersion: 1, requirements: [{ rentalAssetId: rentalId } as never] })
})

it("edits the durations and the cancel cutoff that already persist", async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByRole("heading", { name: "Estúdio A" })).toBeInTheDocument()
  for (const name of ["Dados", "Agenda", "Fila", "Regras", "Preços", "Publicação"]) {
    expect(screen.getByRole("heading", { name: new RegExp(name) })).toBeInTheDocument()
  }
  expect(screen.queryByText(/antecedência|sinal|30%/i)).not.toBeInTheDocument()
  const rules = screen.getByRole("region", { name: "Regras" })
  await user.click(within(rules).getByRole("button", { name: "Editar" }))
  await user.click(await screen.findByRole("button", { name: "60 min" }))
  expect(savePolicy).toHaveBeenCalledWith(expect.objectContaining({ allowedDurationMinutes: "60" }))
  await user.click(screen.getByRole("button", { name: "24 h" }))
  expect(saveFields).toHaveBeenCalledWith({ cancelCutoffMode: "hours", cancelCutoffHours: "24" })
  const audience = await screen.findByRole("link", { name: "Editar no produto" })
  expect(audience).toHaveAttribute("href", `/catalogo/produtos/${productId}/assistente?passo=access`)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("keeps the steps on the page at phone width", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, media: "", addEventListener: () => {}, removeEventListener: () => {} }))
  setup()
  expect(screen.getByRole("button", { name: "Continuar em Fila" })).toHaveClass("w-full")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  vi.unstubAllGlobals()
})
