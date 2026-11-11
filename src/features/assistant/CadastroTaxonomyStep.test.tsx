import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { CadastroTaxonomyStep } from "./CadastroTaxonomyStep"
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
it("selects existing chips and saves product assignments through the product update", async () => {
  const user = userEvent.setup()
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await user.click(await screen.findByRole("button", { name: "Hospedagem" }))
  await user.click(screen.getByRole("button", { name: "Sazonal" }))
  await user.click(screen.getByRole("button", { name: "Salvar passo" }))
  await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: { categoryIds: [category.id], tagIds: [tag.id] } })))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
it("creates categories and tags inline, with a parent picker, and selects the new labels", async () => {
  const user = userEvent.setup()
  vi.mocked(taxonomy.createTaxonomyCategory).mockResolvedValue({ ...category, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Pacotes", slug: "pacotes", parentId: category.id })
  vi.mocked(taxonomy.createTaxonomyTag).mockResolvedValue({ ...tag, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Novo", slug: "novo" })
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  await user.click(await screen.findByRole("button", { name: "Categoria +" }))
  await user.type(screen.getByLabelText("Nome"), "Pacotes")
  await user.click(screen.getByRole("combobox", { name: "Categoria pai" }))
  await user.click(screen.getByRole("option", { name: "Hospedagem" }))
  await user.click(screen.getByRole("button", { name: "Adicionar categoria" }))
  expect(await screen.findByRole("button", { name: "Pacotes" })).toHaveAttribute("aria-pressed", "true")
  expect(taxonomy.createTaxonomyCategory).toHaveBeenCalledWith(expect.objectContaining({ parentId: category.id, slug: "pacotes" }))
  await user.click(screen.getByRole("button", { name: "Tag +" }))
  await user.type(screen.getByLabelText("Nome"), "Novo")
  await user.click(screen.getByRole("button", { name: "Adicionar tag" }))
  expect(await screen.findByRole("button", { name: "Novo" })).toHaveAttribute("aria-pressed", "true")
  await user.click(screen.getByRole("button", { name: "Salvar passo" }))
  await waitFor(() => expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ taxonomy: {
    categoryIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"], tagIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
  } })))
  expect(document.querySelector("select")).toBeNull()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})
it("allows assigning existing labels without exposing create for users without manage", async () => {
  access.manage = false
  render(<CadastroTaxonomyStep product={product} canAssign onSaved={vi.fn()} />)
  expect(await screen.findByRole("button", { name: "Hospedagem" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: "Categoria +" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Tag +" })).not.toBeInTheDocument()
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
  for (const item of categories) {
    await user.click(await screen.findByRole("button", { name: item.name }))
  }
  expect(screen.getByRole("button", { name: "Salvar passo" })).toBeDisabled()
  expect(screen.getByRole("alert")).toHaveTextContent("O limite é 20 categorias e 20 tags.")
  expect(updateCatalogProduct).not.toHaveBeenCalled()
})
it("keeps resource taxonomy create-only without product assignment controls", async () => {
  render(<CadastroTaxonomyStep />)
  expect(await screen.findByText(/não são vinculadas a este recurso/i)).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Salvar passo" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Hospedagem" })).not.toBeInTheDocument()
})
