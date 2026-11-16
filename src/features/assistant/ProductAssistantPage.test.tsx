import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { ProductAssistantPage } from "./ProductAssistantPage"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { listAdminRentalAssets } from "@/features/rentals/services/scheduleService"
import { activateCatalogProduct } from "@/features/catalog/services/catalogService"

vi.mock("@/features/catalog/components/productWizard/useProductWizard", () => ({ useProductWizard: vi.fn() }))
vi.mock("@/features/rentals/services/scheduleService", () => ({ listAdminRentalAssets: vi.fn() }))
vi.mock("@/features/catalog/services/catalogService", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/features/catalog/services/catalogService")>()), activateCatalogProduct: vi.fn() }))

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
    modelRef: { current: null },
    model: {
      product: { id: productId, name: "Diária", isActive: true, usesSchedule: true, currency: "BRL", price: 0, visibility: "Public" },
      access: { visibility: "Public", customerIds: [], groupIds: [] },
      groups: [],
      menuItems: [],
      requirements: [{ rentalAssetId: assetId }],
      resourceCapability: "ready",
    },
  } as never)
})

function setup(entry = `/catalogo/produtos/${productId}/passos`) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/catalogo/produtos/:id/passos" element={<ProductAssistantPage />} />
        <Route path="/catalogo/produtos/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="editor-location">{location.pathname}{location.search}</p>
}

it("sends the non-cadastro assistant to the single product editor", () => {
  setup()
  expect(screen.getByTestId("editor-location")).toHaveTextContent(`/catalogo/produtos/${productId}`)
  expect(screen.queryByRole("region", { name: "Preços" })).not.toBeInTheDocument()
})

it("opens the Agenda tab when the old link targeted the agenda step", () => {
  setup(`/catalogo/produtos/${productId}/passos?passo=agenda`)
  expect(screen.getByTestId("editor-location")).toHaveTextContent(`/catalogo/produtos/${productId}?aba=agenda`)
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
  expect(screen.getByRole("button", { name: /^Fila/ })).toHaveAttribute("aria-current", "step")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  expect(screen.getByRole("button", { name: /^Regras/ })).toHaveAttribute("aria-current", "step")
  await user.click(screen.getByRole("button", { name: "Voltar" }))
  expect(screen.getByRole("button", { name: /^Fila/ })).toHaveAttribute("aria-current", "step")
})
it("defaults an unknown cadastro step to Dados", () => {
  
  renderCadastro("?passo=unknown")
  expect(screen.getByRole("button", { name: /^Dados do produto/ })).toHaveAttribute("aria-current", "step")
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
})
function mockReadyProduct(overrides: { isActive: boolean; menuItems: unknown[]; taxonomy?: unknown }) {
  const publishMenu = vi.fn().mockResolvedValue(true)
  const reload = vi.fn()
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false,
    error: null,
    busy: false,
    readOnly: false,
    rentalsActive: true,
    canManage: true,
    canSearchCustomers: false,
    wizardPath: `/catalogo/produtos/${productId}/assistente`,
    reload,
    publishMenu,
    modelRef: { current: null },
    model: {
      product: { id: productId, name: "Diária", isActive: overrides.isActive, usesSchedule: true, currency: "BRL", price: 10, visibility: "Public", taxonomy: overrides.taxonomy },
      access: { visibility: "Public", customerIds: [], groupIds: [] },
      groups: [],
      menuItems: overrides.menuItems,
      requirements: [{ rentalAssetId: assetId }],
      resourceCapability: "ready",
    },
  } as never)
  return { publishMenu, reload }
}

const activeCatalogMenu = [{ id: "m", moduleName: "catalog", label: "Catálogo", sortOrder: 1, isActive: true }]

it("Publicar activates the draft product and publishes the catalog menu when it is not active", async () => {
  vi.mocked(activateCatalogProduct).mockResolvedValue({} as never)
  const { publishMenu } = mockReadyProduct({ isActive: false, menuItems: [] })
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  await waitFor(() => expect(publishMenu).toHaveBeenCalledTimes(1))
  expect(activateCatalogProduct).toHaveBeenCalledWith(productId)
})

it("Publicar only reloads when the product is active and the menu is already on", async () => {
  const { publishMenu, reload } = mockReadyProduct({ isActive: true, menuItems: activeCatalogMenu })
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  await waitFor(() => expect(reload).toHaveBeenCalled())
  expect(activateCatalogProduct).not.toHaveBeenCalled()
  expect(publishMenu).not.toHaveBeenCalled()
})

it("does not publish the menu when activating fails", async () => {
  vi.mocked(activateCatalogProduct).mockRejectedValue(new Error("falhou"))
  const { publishMenu } = mockReadyProduct({ isActive: false, menuItems: [] })
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  await waitFor(() => expect(activateCatalogProduct).toHaveBeenCalled())
  expect(publishMenu).not.toHaveBeenCalled()
})

it("shows Rascunho and marks steps from the saved data, not from visits", async () => {
  mockReadyProduct({ isActive: false, menuItems: [] })
  const user = userEvent.setup()
  renderCadastro("?passo=dados")
  const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" })
  expect(screen.getByText("Rascunho")).toBeInTheDocument()
  for (const done of ["Dados do produto", "Agenda", "Fila", "Regras", "Preços"]) {
    expect(within(nav).getByRole("button", { name: `${done}, concluída` })).toBeInTheDocument()
  }
  expect(within(nav).getByRole("button", { name: "Categorias e tags" })).toBeInTheDocument()
  expect(within(nav).getByText("Opcional")).toBeInTheDocument()
  expect(within(nav).getByRole("button", { name: "Publicação" })).toBeInTheDocument()
  await user.click(within(nav).getByRole("button", { name: "Publicação" }))
  expect(within(nav).getByRole("button", { name: "Publicação" })).toHaveAttribute("aria-current", "step")
})

it("shows Publicado and completes Categorias when the product has taxonomy", () => {
  mockReadyProduct({ isActive: true, menuItems: activeCatalogMenu, taxonomy: { categories: [{ id: "c", name: "Hospedagem" }], tags: [] } })
  renderCadastro("?passo=dados")
  const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" })
  expect(screen.getByText("Ativo")).toBeInTheDocument()
  expect(within(nav).getByRole("button", { name: "Categorias e tags, concluída" })).toBeInTheDocument()
  expect(within(nav).getByRole("button", { name: "Publicação, concluída" })).toBeInTheDocument()
  expect(within(nav).queryByText("Opcional")).not.toBeInTheDocument()
})

it("keeps Publicar disabled while a setup step is missing", () => {
  renderCadastro("?passo=publicacao")
  expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled()
})

it("keeps taxonomy chips on the page until their assignment has been saved", async () => {
  const user = userEvent.setup()
  renderCadastro("?passo=categorias")
  await user.click(await screen.findByRole("combobox", { name: "Buscar ou selecionar categorias" }))
  await user.click(await screen.findByRole("option", { name: "Hospedagem" }))
  expect(screen.getByRole("button", { name: "Remover Hospedagem" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeEnabled()
  await user.click(screen.getByRole("button", { name: "Remover Hospedagem" }))
  expect(screen.queryByRole("button", { name: "Remover Hospedagem" })).not.toBeInTheDocument()
})
it("keeps unsaved offer changes in Dados and does not block the footer", async () => {
  const user = userEvent.setup()
  renderCadastro()
  await user.type(screen.getByRole("textbox", { name: "Nome do produto *" }), " nova")
  expect(screen.getByRole("textbox", { name: "Nome do produto *" })).toHaveValue("Diária nova")
  expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Categorias e tags" })).toBeEnabled()
})

it("shows Agenda and Fila as not applicable for a product without schedule and skips them", async () => {
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false, error: null, busy: false, readOnly: false, rentalsActive: true, canManage: true, canSearchCustomers: false,
    wizardPath: "", reload: vi.fn(), publishMenu: vi.fn(), modelRef: { current: null },
    model: {
      product: { id: productId, name: "Diária", isActive: false, usesSchedule: false, currency: "BRL", price: 10, visibility: "Public" },
      access: { visibility: "Public", customerIds: [], groupIds: [] }, groups: [], menuItems: [],
      requirements: [], resourceCapability: "ready",
    },
  } as never)
  const user = userEvent.setup()
  renderCadastro("?passo=categorias")
  const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" })
  expect(within(nav).getByRole("group", { name: "Agenda, Não se aplica" })).toBeInTheDocument()
  expect(within(nav).getByRole("group", { name: "Fila, Não se aplica" })).toBeInTheDocument()
  expect(within(nav).queryByRole("button", { name: /^Agenda/ })).not.toBeInTheDocument()
  expect(screen.getByText("Etapa 2 de 5")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await waitFor(() => expect(screen.getByRole("button", { name: /^Regras/ })).toHaveAttribute("aria-current", "step"))
})

function renderCadastroWithRoutes(query: string) {
  return render(<MemoryRouter initialEntries={[`/catalogo/produtos/${productId}/cadastro${query}`]}>
    <TestPermissionProvider permissions={["core.taxonomy.read", "core.taxonomy.manage", "core.module_menu.write"]}>
      <Routes>
        <Route path="/catalogo/produtos/:id/cadastro" element={<ProductAssistantPage cadastro />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </TestPermissionProvider>
  </MemoryRouter>)
}

it("summarizes the product before publishing, with Sob consulta and an Editar link per step", async () => {
  const user = userEvent.setup()
  vi.mocked(useProductWizard).mockReturnValue({
    loading: false, error: null, busy: false, readOnly: false, rentalsActive: true, canManage: true, canSearchCustomers: false,
    wizardPath: "", reload: vi.fn(), publishMenu: vi.fn(), modelRef: { current: null },
    model: {
      product: { id: productId, name: "Diária", isActive: false, usesSchedule: false, currency: "BRL", price: null, visibility: "Restricted", taxonomy: { categories: [{ id: "c", name: "Hospedagem" }], tags: [] } },
      access: { visibility: "Restricted", customerIds: [], groupIds: [] }, groups: [], menuItems: [],
      requirements: [], resourceCapability: "ready",
    },
  } as never)
  renderCadastro("?passo=publicacao")
  expect(screen.getByTestId("review-name")).toHaveTextContent("Diária")
  expect(screen.getByTestId("review-categories")).toHaveTextContent("Hospedagem")
  expect(screen.getByTestId("review-price")).toHaveTextContent("Sob consulta")
  expect(screen.getByTestId("review-agenda")).toHaveTextContent("Não usa agenda")
  expect(screen.getByTestId("review-visibility")).toHaveTextContent("Restrito")
  await user.click(screen.getByRole("button", { name: "Editar Preço" }))
  expect(screen.getByRole("button", { name: /^Preços/ })).toHaveAttribute("aria-current", "step")
})

it("lists the linked resources and the formatted price in the summary", () => {
  mockReadyProduct({ isActive: false, menuItems: [] })
  renderCadastro("?passo=publicacao")
  return waitFor(() => expect(screen.getByTestId("review-agenda")).toHaveTextContent("Estúdio A")).then(() => {
    expect(screen.getByTestId("review-price")).toHaveTextContent("R$ 10,00")
  })
})

it("replaces the step with a success state after Publicar and offers the next actions", async () => {
  vi.mocked(activateCatalogProduct).mockResolvedValue({} as never)
  mockReadyProduct({ isActive: false, menuItems: [] })
  const user = userEvent.setup()
  renderCadastroWithRoutes("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  expect(await screen.findByText("Produto publicado")).toBeInTheDocument()
  expect(screen.getByText(/Diária · R\$ 10,00/)).toBeInTheDocument()
  expect(screen.getByText(/\(Público\)/)).toBeInTheDocument()
  expect(screen.queryByText("Revise o que falta e publique para os clientes.")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ver na lista de produtos" })).toHaveAttribute("href", "/catalogo/produtos")
  expect(screen.getByRole("link", { name: "Criar outro produto" })).toHaveAttribute("href", "/catalogo/produtos/cadastro")
  await user.click(screen.getByRole("link", { name: "Continuar editando" }))
  expect(screen.getByTestId("editor-location")).toHaveTextContent(`/catalogo/produtos/${productId}`)
})

it("announces Produto ativo and stays on the step when the publish is refused", async () => {
  const { toast } = await import("sonner")
  const success = vi.spyOn(toast, "success").mockReturnValue(1)
  const error = vi.spyOn(toast, "error").mockReturnValue(1)
  vi.mocked(activateCatalogProduct).mockRejectedValueOnce(new Error("Não dá para ativar: falta o preço."))
  mockReadyProduct({ isActive: false, menuItems: [] })
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  await waitFor(() => expect(error).toHaveBeenCalledWith("Não dá para ativar: falta o preço."))
  expect(screen.queryByText("Produto publicado")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Publicar" })).toBeEnabled()
  vi.mocked(activateCatalogProduct).mockResolvedValueOnce({} as never)
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  await screen.findByText("Produto publicado")
  expect(success).toHaveBeenCalledWith("Produto ativo.")
})

it("stays on the step with a muted note when the product is active but the menu step failed", async () => {
  vi.mocked(activateCatalogProduct).mockResolvedValue({} as never)
  const { publishMenu } = mockReadyProduct({ isActive: false, menuItems: [] })
  publishMenu.mockResolvedValue(false)
  const user = userEvent.setup()
  renderCadastro("?passo=publicacao")
  await user.click(screen.getByRole("button", { name: "Publicar" }))
  expect(await screen.findByText("O produto está ativo, mas não entrou no menu do portal.")).toBeInTheDocument()
  expect(screen.queryByText("Produto publicado")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Publicar" })).toBeEnabled()
})
