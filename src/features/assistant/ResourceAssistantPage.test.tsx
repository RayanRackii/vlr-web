import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
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
const savePrices = vi.fn()

function mockWizard(overrides: Partial<AdminRentalAsset> = {}, prices: readonly { pricePerHour: number }[] = []) {
  vi.mocked(useResourceWizard).mockReturnValue({
    loading: false,
    error: null,
    model: { asset: { ...asset, ...overrides }, menuItems: [], templates: [], kinds: [], prices },
    access: { menuWrite: true, assetWrite: true, scheduleRead: true, scheduleWrite: true, pricingRead: true, pricingWrite: true, pricingReplace: true },
    busy: false,
    busyAction: null,
    wizardPath: `/configuracoes/recursos/${rentalId}/assistente`,
    savePolicy,
    saveQueue,
    saveFields,
    savePrices,
    publishMenu: vi.fn(),
    seedTemplates: vi.fn(),
    reload: vi.fn(),
  } as never)
}

function setup(overrides: Partial<AdminRentalAsset> = {}, prices: readonly { pricePerHour: number }[] = []) {
  mockWizard(overrides, prices)
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
  expect(audience).toHaveAttribute("href", `/catalogo/produtos/${productId}/cadastro?passo=regras`)
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

function cadastroTree(query = "") {
  return <MemoryRouter initialEntries={[`/configuracoes/recursos/${rentalId}/cadastro${query}`]}>
    <TestPermissionProvider permissions={["core.taxonomy.read", "core.taxonomy.manage", "core.module_menu.write"]}>
      <Routes><Route path="/configuracoes/recursos/:id/cadastro" element={<ResourceAssistantPage cadastro />} /></Routes>
    </TestPermissionProvider>
  </MemoryRouter>
}

function renderCadastro(query = "") {
  return render(cadastroTree(query))
}
it("opens cadastro as one full page with a horizontal rail and query-controlled steps", async () => {
  setup().unmount()
  const user = userEvent.setup()
  renderCadastro("?passo=fila")
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Fila" })).toHaveAttribute("aria-current", "step")
  await user.click(screen.getByRole("button", { name: "Continuar" }))
  expect(screen.getByRole("button", { name: "Regras" })).toHaveAttribute("aria-current", "step")
  await user.click(screen.getByRole("button", { name: "Voltar" }))
  expect(screen.getByRole("button", { name: "Fila" })).toHaveAttribute("aria-current", "step")
})
it("defaults an unknown cadastro step to Dados", () => {
  setup().unmount()
  renderCadastro("?passo=unknown")
  expect(screen.getByRole("button", { name: "Dados" })).toHaveAttribute("aria-current", "step")
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
})
it("publishes from the last cadastro step through the existing assistant action", async () => {
  setup({
    queueOpeningTime: "08:00:00",
    allowedDurationMinutes: "60",
    cancelCutoffHours: 24,
  }, [{ pricePerHour: 10 }]).unmount()
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  expect(vi.mocked(useResourceWizard).mock.results.at(-1)?.value.publishMenu).toHaveBeenCalled()
})

it("keeps Publicar disabled while a setup step is missing", () => {
  setup().unmount()
  renderCadastro("?passo=publicacao")
  expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled()
})

it("keeps the price form dirty when the save fails", async () => {
  savePrices.mockResolvedValueOnce(false)
  setup().unmount()
  const user = userEvent.setup()
  renderCadastro("?passo=precos")
  await user.type(screen.getByRole("textbox", { name: "Valor" }), "50")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Substituir preços da semana" }))
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  expect(screen.getByRole("textbox", { name: "Valor" })).toHaveValue("50")
})

it("clears the lead field and re-enables Continuar when the value is inherited", async () => {
  const user = userEvent.setup()
  setup({ minimumBookingLeadMinutes: 90, effectiveMinimumBookingLeadMinutes: 90 }).unmount()
  const view = renderCadastro("?passo=regras")
  const lead = () => screen.getByRole("region", { name: "Antecedência mínima" })
  expect(within(lead()).getByRole("textbox", { name: "Minutos deste recurso" })).toHaveValue("90")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled()
  mockWizard({ minimumBookingLeadMinutes: null, effectiveMinimumBookingLeadMinutes: 180 })
  await user.click(within(lead()).getByRole("button", { name: "Usar o valor herdado" }))
  view.rerender(cadastroTree("?passo=regras"))
  expect(within(lead()).getByRole("textbox", { name: "Minutos deste recurso" })).toHaveValue("")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled()
})

it("re-enables Continuar after saving a zero-padded lead", async () => {
  const user = userEvent.setup()
  setup({ minimumBookingLeadMinutes: null, effectiveMinimumBookingLeadMinutes: 180 }).unmount()
  const view = renderCadastro("?passo=regras")
  const lead = () => screen.getByRole("region", { name: "Antecedência mínima" })
  await user.type(within(lead()).getByRole("textbox", { name: "Minutos deste recurso" }), "090")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  mockWizard({ minimumBookingLeadMinutes: 90, effectiveMinimumBookingLeadMinutes: 90 })
  await user.click(within(lead()).getByRole("button", { name: "Salvar passo" }))
  view.rerender(cadastroTree("?passo=regras"))
  expect(within(lead()).getByRole("textbox", { name: "Minutos deste recurso" })).toHaveValue("90")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled()
})

it("disables Continuar while the price draft is open and enables it after a successful save", async () => {
  setup().unmount()
  const user = userEvent.setup()
  renderCadastro("?passo=precos")
  const continuar = screen.getByRole("button", { name: "Continuar" })
  expect(continuar).toBeEnabled()
  await user.type(screen.getByRole("textbox", { name: "Valor" }), "50")
  expect(continuar).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Substituir preços da semana" }))
  expect(continuar).toBeEnabled()
})

it("disables Continuar while lead or deposit is edited and enables it when the stored value matches", async () => {
  const user = userEvent.setup()
  setup({
    minimumBookingLeadMinutes: null,
    effectiveMinimumBookingLeadMinutes: 180,
    depositPercent: null,
    effectiveDepositPercent: null,
  }).unmount()
  const view = renderCadastro("?passo=regras")
  const continuar = screen.getByRole("button", { name: "Continuar" })
  expect(continuar).toBeEnabled()

  const lead = screen.getByRole("region", { name: "Antecedência mínima" })
  await user.type(within(lead).getByRole("textbox", { name: "Minutos deste recurso" }), "90")
  expect(continuar).toBeDisabled()
  mockWizard({
    minimumBookingLeadMinutes: 90,
    effectiveMinimumBookingLeadMinutes: 90,
    depositPercent: null,
    effectiveDepositPercent: null,
  })
  await user.click(within(lead).getByRole("button", { name: "Salvar passo" }))
  view.rerender(cadastroTree("?passo=regras"))
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled()

  const deposit = screen.getByRole("region", { name: "Percentual de sinal" })
  await user.type(within(deposit).getByRole("textbox", { name: "Percentual deste recurso" }), "30")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  mockWizard({
    minimumBookingLeadMinutes: 90,
    effectiveMinimumBookingLeadMinutes: 90,
    depositPercent: 30,
    effectiveDepositPercent: 30,
  })
  await user.click(within(deposit).getByRole("button", { name: "Salvar passo" }))
  view.rerender(cadastroTree("?passo=regras"))
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled()
})

it("validates the new resource Dados name and retains an invalid dirty draft", async () => {
  setup().unmount()
  const user = userEvent.setup()
  renderCadastro()
  await user.clear(screen.getByRole("textbox", { name: "Nome" }))
  expect(screen.getByRole("button", { name: "Salvar passo" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  await user.type(screen.getByRole("textbox", { name: "Nome" }), "Sala nova")
  expect(screen.getByRole("button", { name: "Salvar passo" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
})
