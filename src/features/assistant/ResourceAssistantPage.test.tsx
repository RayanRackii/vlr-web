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

function setup(overrides: Partial<AdminRentalAsset> = {}) {
  vi.mocked(useResourceWizard).mockReturnValue({
    loading: false,
    error: null,
    model: { asset: { ...asset, ...overrides }, menuItems: [], templates: [], kinds: [], prices: [] },
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

it("overrides the inherited lead and deposit, and clears the deposit", async () => {
  const user = userEvent.setup()
  setup({
    minimumBookingLeadMinutes: null,
    effectiveMinimumBookingLeadMinutes: 180,
    depositPercent: 30,
    effectiveDepositPercent: 30,
  })
  await user.click(within(screen.getByRole("region", { name: "Regras" })).getByRole("button", { name: "Editar" }))

  const lead = screen.getByRole("region", { name: "Antecedência mínima" })
  expect(within(lead).getByRole("status")).toHaveTextContent("Herdado: 180 min.")
  expect(within(lead).queryByRole("button", { name: "Usar o valor herdado" })).not.toBeInTheDocument()
  await user.type(within(lead).getByRole("textbox", { name: "Minutos deste recurso" }), "90")
  await user.click(within(lead).getByRole("button", { name: "Salvar passo" }))
  expect(savePolicy).toHaveBeenCalledWith({
    schedulePolicy: "OpenHours",
    openTime: "08:00:00",
    closeTime: "20:00:00",
    allowedDurationMinutes: null,
    minimumBookingLeadMinutes: 90,
  })

  const deposit = screen.getByRole("region", { name: "Percentual de sinal" })
  expect(deposit).toHaveTextContent("Este percentual fica só salvo. Ainda não há cobrança parcial.")
  expect(within(deposit).getByRole("status")).toHaveTextContent("Neste recurso: 30%.")
  expect(within(deposit).getByRole("button", { name: "Salvar passo" })).toHaveClass("w-full")
  await user.click(within(deposit).getByRole("button", { name: "Usar o valor herdado" }))
  expect(savePolicy).toHaveBeenLastCalledWith({
    schedulePolicy: "OpenHours",
    openTime: "08:00:00",
    closeTime: "20:00:00",
    allowedDurationMinutes: null,
    depositPercent: null,
  })

  await user.clear(within(lead).getByRole("textbox", { name: "Minutos deste recurso" }))
  await user.type(within(lead).getByRole("textbox", { name: "Minutos deste recurso" }), "525601")
  await user.click(within(lead).getByRole("button", { name: "Salvar passo" }))
  expect(within(lead).getByRole("alert")).toHaveTextContent("Use um número inteiro de 0 a 525600.")
  expect(savePolicy).toHaveBeenCalledTimes(2)
})

it("keeps the steps on the page at phone width", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, media: "", addEventListener: () => {}, removeEventListener: () => {} }))
  setup()
  expect(screen.getByRole("button", { name: "Continuar em Fila" })).toHaveClass("w-full")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  vi.unstubAllGlobals()
})
