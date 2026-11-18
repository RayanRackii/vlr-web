import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { CadastroTaxonomyStep } from "./CadastroTaxonomyStep"
import { createStepShell } from "./testStepShell"
import * as taxonomy from "@/features/taxonomy/services/taxonomyService"
import { updateCatalogProduct } from "@/features/catalog/services/catalogService"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"

const access = vi.hoisted(() => ({ manage: true }))
vi.mock("@/features/users/permissions/PermissionContext", () => ({ usePermissions: () => ({ can: (key: string) => key !== "core.taxonomy.manage" || access.manage }) }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({ useTrialStatus: () => ({ isTrialReadOnly: false }) }))
vi.mock("@/features/taxonomy/services/taxonomyService", () => ({ listTaxonomyCategories: vi.fn(), listTaxonomyTags: vi.fn(), createTaxonomyCategory: vi.fn(), createTaxonomyTag: vi.fn() }))
vi.mock("@/features/catalog/services/catalogService", () => ({ updateCatalogProduct: vi.fn() }))
const category = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Hospedagem", slug: "hospedagem", parentId: null, icon: null, sortOrder: 0 }
const tag = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Sazonal", slug: "sazonal" }
const product = { id: "p1", name: "Diária", price: 20, currency: "BRL", taxonomy: { categories: [], tags: [] } } as unknown as CatalogProduct
beforeEach(() => {
  vi.clearAllMocks()
  access.manage = true
  vi.mocked(taxonomy.listTaxonomyCategories).mockResolvedValue([category])
  vi.mocked(taxonomy.listTaxonomyTags).mockResolvedValue([tag])
  vi.mocked(updateCatalogProduct).mockResolvedValue(product)
})

async function pickCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ }))
  await user.click(await screen.findByRole("option", { name }))
}

it("selects categories in the combobox, shows removable chips and saves through the product update", async () => {
  const user = userEvent.setup()
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await pickCategory(user, "Hospedagem")
  const chips = screen.getAllByRole("listitem")
  expect(chips).toHaveLength(1)
  expect(within(chips[0]).getByText("Hospedagem")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Salvar passo" }))
  await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: { categoryIds: [category.id], tagIds: [] } })))
})

it("filters the combobox by search text and removes a category from its chip", async () => {
  const user = userEvent.setup()
  vi.mocked(taxonomy.listTaxonomyCategories).mockResolvedValue([category, { ...category, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Pacotes", slug: "pacotes" }])
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await user.click(await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ }))
  await user.type(await screen.findByRole("textbox", { name: "Buscar categorias" }), "pac")
  expect(screen.queryByRole("option", { name: "Hospedagem" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("option", { name: "Pacotes" }))
  expect(screen.getByRole("option", { name: /Pacotes/ })).toHaveAttribute("aria-selected", "true")
  await user.click(screen.getByRole("button", { name: "Remover Pacotes" }))
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
})

it("shows no-results with a create link only when the user can manage taxonomy", async () => {
  const user = userEvent.setup()
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await user.click(await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ }))
  await user.type(await screen.findByRole("textbox", { name: "Buscar categorias" }), "zzz")
  expect(screen.getByText("Nenhuma categoria encontrada")).toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: "Criar nova categoria" }).length).toBeGreaterThan(0)
})

it("hides the create-category buttons without manage permission but still assigns existing labels", async () => {
  const user = userEvent.setup()
  access.manage = false
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await pickCategory(user, "Hospedagem")
  expect(screen.queryByRole("button", { name: "Criar nova categoria" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Criar categoria" })).not.toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Tags" })).toHaveAttribute("placeholder", "Digite para buscar uma tag")
})

it("shows the empty-state box and the create button only with manage permission", async () => {
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  expect(await screen.findByRole("button", { name: "Criar categoria" })).toBeInTheDocument()
  expect(screen.getByText("Nenhuma categoria selecionada")).toBeInTheDocument()
  expect(screen.getByText("Selecione uma categoria existente ou crie uma nova.")).toBeInTheDocument()
})

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Criar categoria" }))
  return await screen.findByRole("dialog", { name: "Criar categoria" })
}

it("opens the create dialog with its fields, previews the slug from the name and lets the user edit it", async () => {
  const user = userEvent.setup()
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const dialog = await openDialog(user)
  expect(within(dialog).getByText("Organize seu catálogo sem sair do cadastro.")).toBeInTheDocument()
  const name = within(dialog).getByLabelText("Nome da categoria *")
  expect(name).toHaveFocus()
  expect(within(dialog).getByText("Use um nome curto e fácil de reconhecer.")).toBeInTheDocument()
  expect(within(dialog).getByText("Disponível em todo o catálogo deste espaço.")).toBeInTheDocument()
  expect(within(dialog).getByText("Ao criar, a categoria será selecionada neste produto.")).toBeInTheDocument()
  expect(within(dialog).getByRole("button", { name: "Criar e selecionar" })).toBeDisabled()
  await user.type(name, "Fotografia Pro")
  expect(within(dialog).getByText("fotografia-pro")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Editar" }))
  const slug = within(dialog).getByLabelText("Endereço da categoria")
  expect(slug).toHaveValue("fotografia-pro")
  await user.clear(slug)
  await user.type(slug, "foto")
  await user.type(name, "x")
  expect(slug).toHaveValue("foto")
})

it("creates a category with name, parent and slug, selects it, shows the success line and saves through the product update", async () => {
  const user = userEvent.setup()
  const created = { ...category, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Pacotes", slug: "pacotes", parentId: category.id }
  vi.mocked(taxonomy.createTaxonomyCategory).mockResolvedValue(created)
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const dialog = await openDialog(user)
  await user.type(within(dialog).getByLabelText("Nome da categoria *"), "Pacotes")
  await user.click(within(dialog).getByRole("combobox", { name: "Categoria principal (opcional)" }))
  await user.click(await screen.findByRole("option", { name: "Hospedagem" }))
  expect(within(dialog).getByText("Pacotes será uma subcategoria de Hospedagem.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "Criar e selecionar" }))
  expect(await screen.findByRole("button", { name: "Remover Pacotes" })).toBeInTheDocument()
  expect(taxonomy.createTaxonomyCategory).toHaveBeenCalledWith({ name: "Pacotes", slug: "pacotes", parentId: category.id, icon: null, sortOrder: 0 })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByText("✓ Categoria criada e selecionada para este produto.")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Salvar passo" }))
  await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: { categoryIds: [created.id], tagIds: [] } })))
})

it("keeps the dialog open and shows the API error when creating a category fails", async () => {
  const user = userEvent.setup()
  vi.mocked(taxonomy.createTaxonomyCategory).mockRejectedValue(new Error("Categoria duplicada"))
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const dialog = await openDialog(user)
  await user.type(within(dialog).getByLabelText("Nome da categoria *"), "Hospedagem")
  await user.click(within(dialog).getByRole("button", { name: "Criar e selecionar" }))
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Categoria duplicada")
  expect(screen.getByRole("dialog")).toBeInTheDocument()
  expect(screen.queryByText(/Categoria criada e selecionada/)).not.toBeInTheDocument()
  expect(within(dialog).getByRole("button", { name: "Criar e selecionar" })).toBeEnabled()
})

it("guards against double submit while the category is being created", async () => {
  const user = userEvent.setup()
  let resolve: (value: typeof category) => void = () => {}
  vi.mocked(taxonomy.createTaxonomyCategory).mockReturnValue(new Promise((done) => { resolve = done }))
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const dialog = await openDialog(user)
  await user.type(within(dialog).getByLabelText("Nome da categoria *"), "Novo")
  const submit = within(dialog).getByRole("button", { name: "Criar e selecionar" })
  await user.click(submit)
  await user.click(submit)
  expect(taxonomy.createTaxonomyCategory).toHaveBeenCalledTimes(1)
  await act(async () => { resolve({ ...category, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Novo", slug: "novo" }) })
  expect(await screen.findByRole("button", { name: "Remover Novo" })).toBeInTheDocument()
})

it("cancels the dialog without creating anything", async () => {
  const user = userEvent.setup()
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole("button", { name: "Cancelar" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(taxonomy.createTaxonomyCategory).not.toHaveBeenCalled()
})

it("creates a category from the dialog inside the wizard shell, and the shell submit saves the selection", async () => {
  const user = userEvent.setup()
  const created = { ...category, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Pacotes", slug: "pacotes" }
  vi.mocked(taxonomy.createTaxonomyCategory).mockResolvedValue(created)
  const { StepShell, shell } = createStepShell()
  render(<StepShell><CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} /></StepShell>)
  const dialog = await openDialog(user)
  await user.type(within(dialog).getByLabelText("Nome da categoria *"), "Pacotes")
  await user.click(within(dialog).getByRole("button", { name: "Criar e selecionar" }))
  expect(await screen.findByRole("button", { name: "Remover Pacotes" })).toBeInTheDocument()
  let result: boolean | null = null
  await act(async () => { result = await shell.submit() })
  expect(result).toBe(true)
  expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: { categoryIds: [created.id], tagIds: [] } }))
})

it("adds an existing tag on Enter, suggests while typing, and creates a new one when allowed", async () => {
  const user = userEvent.setup()
  vi.mocked(taxonomy.createTaxonomyTag).mockResolvedValue({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Novo", slug: "novo" })
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const input = await screen.findByRole("textbox", { name: "Tags" })
  await user.type(input, "saz")
  expect(screen.getByRole("option", { name: "Sazonal" })).toBeInTheDocument()
  await user.clear(input)
  await user.type(input, "sazonal{Enter}")
  expect(taxonomy.createTaxonomyTag).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Remover Sazonal" })).toBeInTheDocument()
  await user.type(input, "Novo{Enter}")
  expect(await screen.findByRole("button", { name: "Remover Novo" })).toBeInTheDocument()
  expect(taxonomy.createTaxonomyTag).toHaveBeenCalledWith({ name: "Novo", slug: "novo" })
  await user.click(screen.getByRole("button", { name: "Salvar passo" }))
  await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: { categoryIds: [], tagIds: [tag.id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"] } })))
})

it("is select-only for tags without manage: Enter never creates", async () => {
  const user = userEvent.setup()
  access.manage = false
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const input = await screen.findByRole("textbox", { name: "Tags" })
  await user.type(input, "inexistente{Enter}")
  expect(taxonomy.createTaxonomyTag).not.toHaveBeenCalled()
  expect(screen.getAllByText("Nenhuma tag encontrada").length).toBeGreaterThan(0)
  await user.clear(input)
  await user.type(input, "saz{Enter}")
  expect(screen.getByRole("button", { name: "Remover Sazonal" })).toBeInTheDocument()
})

it("shows an inline error when creating a tag fails and keeps the typed text", async () => {
  const user = userEvent.setup()
  vi.mocked(taxonomy.createTaxonomyTag).mockRejectedValue(new Error("Tag duplicada"))
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  const input = await screen.findByRole("textbox", { name: "Tags" })
  await user.type(input, "Novo{Enter}")
  expect(await screen.findByRole("alert")).toHaveTextContent("Tag duplicada")
  expect(input).toHaveValue("Novo")
})

it("renders the loading skeleton, the load error with retry, and the empty catalog", async () => {
  const user = userEvent.setup()
  vi.mocked(taxonomy.listTaxonomyCategories).mockRejectedValueOnce(new Error("Falhou"))
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  expect(screen.getByRole("status")).toBeInTheDocument()
  expect(await screen.findByRole("alert")).toHaveTextContent("Falhou")
  vi.mocked(taxonomy.listTaxonomyCategories).mockResolvedValue([])
  vi.mocked(taxonomy.listTaxonomyTags).mockResolvedValue([])
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }))
  await user.click(await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ }))
  expect(await screen.findByText("Nenhuma categoria cadastrada.")).toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: "Criar nova categoria" }).length).toBeGreaterThan(0)
})

it("disables save and shows the limit when more than 20 categories are selected", async () => {
  const user = userEvent.setup()
  const categories = Array.from({ length: 21 }, (_, index) => ({
    ...category,
    id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    name: `Categoria ${index + 1}`,
    slug: `categoria-${index + 1}`,
  }))
  vi.mocked(taxonomy.listTaxonomyCategories).mockResolvedValue(categories)
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await user.click(await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ }))
  for (const item of categories) {
    await user.click(await screen.findByRole("option", { name: item.name }))
  }
  expect(screen.getByRole("button", { name: "Salvar passo" })).toBeDisabled()
  expect(screen.getByText("O limite é 20 categorias e 20 tags.")).toBeInTheDocument()
  expect(updateCatalogProduct).not.toHaveBeenCalled()
})

it("keeps resource taxonomy create-only without product assignment controls", async () => {
  render(<CadastroTaxonomyStep />)
  expect(await screen.findByText(/não são vinculadas a este recurso/i)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Salvar passo" })).not.toBeInTheDocument()
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Categoria +" })).toBeInTheDocument()
})

it("inside a shell hides its Save button and registers a submit that saves, resolving true", async () => {
  const user = userEvent.setup()
  const { StepShell, shell } = createStepShell()
  render(<StepShell><CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} /></StepShell>)
  await pickCategory(user, "Hospedagem")
  expect(screen.queryByRole("button", { name: "Salvar passo" })).not.toBeInTheDocument()
  let result: boolean | null = null
  await act(async () => { result = await shell.submit() })
  expect(result).toBe(true)
  expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: { categoryIds: [category.id], tagIds: [] } }))
})

it("inside a shell resolves true without a request when nothing changed (step is optional)", async () => {
  const { StepShell, shell } = createStepShell()
  render(<StepShell><CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} /></StepShell>)
  await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ })
  let result: boolean | null = null
  await act(async () => { result = await shell.submit() })
  expect(result).toBe(true)
  expect(updateCatalogProduct).not.toHaveBeenCalled()
})

it("inside a shell resolves false and shows an inline error when the request fails, keeping the selection", async () => {
  const user = userEvent.setup()
  vi.mocked(updateCatalogProduct).mockRejectedValue(new Error("Servidor indisponível"))
  const { StepShell, shell } = createStepShell()
  render(<StepShell><CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} /></StepShell>)
  await pickCategory(user, "Hospedagem")
  let result: boolean | null = null
  await act(async () => { result = await shell.submit() })
  expect(result).toBe(false)
  expect(await screen.findByText("Servidor indisponível")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Remover Hospedagem" })).toBeInTheDocument()
})

it("inside a shell resolves false over the 20-item limit without a request", async () => {
  const user = userEvent.setup()
  const categories = Array.from({ length: 21 }, (_, index) => ({ ...category, id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`, name: `Categoria ${index + 1}`, slug: `categoria-${index + 1}` }))
  vi.mocked(taxonomy.listTaxonomyCategories).mockResolvedValue(categories)
  const { StepShell, shell } = createStepShell()
  render(<StepShell><CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} /></StepShell>)
  await user.click(await screen.findByRole("combobox", { name: /Buscar ou selecionar categorias/ }))
  for (const item of categories) await user.click(await screen.findByRole("option", { name: item.name }))
  let result: boolean | null = null
  await act(async () => { result = await shell.submit() })
  expect(result).toBe(false)
  expect(updateCatalogProduct).not.toHaveBeenCalled()
})
