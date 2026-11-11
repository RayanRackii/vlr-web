import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { ProductAssistantPage } from "./ProductAssistantPage"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"

vi.mock("@/features/catalog/components/productWizard/useProductWizard", () => ({ useProductWizard: vi.fn() }))
vi.mock("@/features/rentals/services/scheduleService", () => ({ listAdminRentalAssets: vi.fn() }))

vi.mock("@/features/taxonomy/services/taxonomyService", () => ({
  listTaxonomyCategories: vi.fn().mockResolvedValue([{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Hospedagem", slug: "hospedagem", parentId: null, icon: null, sortOrder: 0 }]),
  listTaxonomyTags: vi.fn().mockResolvedValue([]),
  createTaxonomyCategory: vi.fn(), createTaxonomyTag: vi.fn(),
}))

const productId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const assetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAdminRentalAssets).mockResolvedValue([{ id: assetId, name: "Estúdio A", queueEnabled: false, queueOpeningTime: null } as never])
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false,
    error: null,
    busy: false,
    rentalsActive: true,
    canManage: true,
    canSearchCustomers: false,
    wizardPath: `/catalogo/produtos/${productId}/assistente`,
    reload: vi.fn(),
    publishMenu: vi.fn(),
    model: {
      product: { id: productId, name: "Diária", isActive: true, price: null, visibility: "Public" },
      access: { visibility: "Public", customerIds: [], groupIds: [] },
      groups: [],
      menuItems: [],
      requirements: [{ rentalAssetId: assetId }],
      resourceCapability: "ready",
    },
  } as never)
})

function setup() {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/produtos/${productId}/passos`]}>
      <Routes><Route path="/catalogo/produtos/:id/passos" element={<ProductAssistantPage />} /></Routes>
    </MemoryRouter>,
  )
}

it("shows the same unfinished steps in the badge and the rows", () => {
  setup()
  expect(screen.getByText("Falta 1 passo")).toBeInTheDocument()
  expect(screen.getAllByText("Pendente")).toHaveLength(1)
  expect(within(screen.getByRole("region", { name: "Preços" })).getByText("Pendente")).toBeInTheDocument()
  expect(screen.getAllByText("Completo")).toHaveLength(4)
})

it("links the used resource and does not invent a deposit or a lead time", async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.getByRole("heading", { name: "Diária" })).toBeInTheDocument()
  for (const name of ["Dados", "Agenda", "Fila", "Regras", "Preços", "Publicação"]) {
    expect(screen.getByRole("heading", { name: new RegExp(name) })).toBeInTheDocument()
  }
  expect(screen.queryByText(/antecedência|sinal|30%/i)).not.toBeInTheDocument()
  await user.click(within(screen.getByRole("region", { name: "Publicação" })).getByRole("button", { name: "Editar" }))
  const link = await screen.findByRole("link", { name: "Abrir recurso" })
  expect(link).toHaveAttribute("href", `/configuracoes/recursos/${assetId}/cadastro`)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Continuar em Preços" })).toHaveClass("w-full")
})

function renderCadastro(query = "") {
  return render(<MemoryRouter initialEntries={[`/catalogo/produtos/${productId}/cadastro${query}`]}>
    <TestPermissionProvider permissions={["core.taxonomy.read", "core.taxonomy.manage", "core.module_menu.write"]}>
      <Routes><Route path="/catalogo/produtos/:id/cadastro" element={<ProductAssistantPage cadastro />} /></Routes>
    </TestPermissionProvider>
  </MemoryRouter>)
}
it("opens cadastro as one full page with a horizontal rail and query-controlled steps", async () => {
  
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
  
  renderCadastro("?passo=unknown")
  expect(screen.getByRole("button", { name: "Dados" })).toHaveAttribute("aria-current", "step")
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
})
it("publishes from the last cadastro step through the existing assistant action", async () => {
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false,
    error: null,
    busy: false,
    rentalsActive: true,
    canManage: true,
    canSearchCustomers: false,
    wizardPath: `/catalogo/produtos/${productId}/assistente`,
    reload: vi.fn(),
    publishMenu: vi.fn(),
    model: {
      product: { id: productId, name: "Diária", isActive: true, price: 10, visibility: "Public" },
      access: { visibility: "Public", customerIds: [], groupIds: [] },
      groups: [],
      menuItems: [],
      requirements: [{ rentalAssetId: assetId }],
      resourceCapability: "ready",
    },
  } as never)
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  expect(vi.mocked(useProductWizard).mock.results.at(-1)?.value.publishMenu).toHaveBeenCalled()
})

it("keeps Publicar disabled while a setup step is missing", () => {
  renderCadastro("?passo=publicacao")
  expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled()
})

it("keeps taxonomy chips on the page until their assignment has been saved", async () => {
  const user = userEvent.setup()
  renderCadastro("?passo=categorias")
  await user.click(await screen.findByRole("button", { name: "Hospedagem" }))
  expect(screen.getByRole("button", { name: "Hospedagem" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("button", { name: "Hospedagem" })).toHaveClass("w-fit")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Agenda" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled()
  await user.click(screen.getByRole("button", { name: "Hospedagem" }))
  expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled()
})
it("keeps unsaved offer changes in Dados until saved or restored", async () => {
  const user = userEvent.setup()
  renderCadastro()
  await user.type(screen.getByRole("textbox", { name: "Nome" }), " nova")
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Categorias e tags" })).toBeDisabled()
})
