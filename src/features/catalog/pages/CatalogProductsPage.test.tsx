import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { productWizardPath } from "@/features/catalog/components/productWizard/wizardSteps"
import { CatalogProductsPage } from "@/features/catalog/pages/CatalogProductsPage"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/catalog/services/catalogService", () => ({
  listCatalogProducts: vi.fn(),
  listProductRequests: vi.fn(),
  activateCatalogProduct: vi.fn(),
  deactivateCatalogProduct: vi.fn(),
  deleteCatalogProductFile: vi.fn(),
  getCatalogProductFileUrl: vi.fn(),
  uploadCatalogProductFile: vi.fn(),
  getCatalogProductAccess: vi.fn().mockResolvedValue({ productId: "x", visibility: "Public", customerIds: [], groupIds: [], restrictedWithoutGrants: false }),
  getCatalogProductAccessHistory: vi.fn().mockResolvedValue([]),
  listCustomerGroups: vi.fn().mockResolvedValue([]),
  putCatalogProductAccess: vi.fn(),
  getCatalogProductResourceRequirements: vi.fn().mockResolvedValue({ expectedVersion: 0, requirements: [] }),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  listTenantModuleMenuItems: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/features/users/services/usersService", () => ({
  listTenantCustomers: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 }),
}))

vi.mock("@/features/taxonomy/services/taxonomyService", () => ({
  getCatalogTaxonomyOptions: vi.fn(),
}))

import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  listCatalogProducts,
  listProductRequests,
} from "@/features/catalog/services/catalogService"
import { getCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"

const listProductsMock = vi.mocked(listCatalogProducts)
const listRequestsMock = vi.mocked(listProductRequests)
const getTaxonomyOptionsMock = vi.mocked(getCatalogTaxonomyOptions)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

function productsTable() {
  return screen.getByRole("table", { name: i18n.t("catalog.products.title") })
}

const PRODUCT: CatalogProduct = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Raquete",
  code: "RAQ",
  description: "Carbono",
  price: 10.5,
  currency: "BRL",
  isActive: true,
  usesSchedule: true,
  createdAt: "2026-10-14T00:00:00.000Z",
  files: [],
      visibility: "Public",
      grantedCustomerCount: 0,
      grantedGroupCount: 0,
}

describe("CatalogProductsPage validity gate", () => {
  beforeEach(() => {
    listProductsMock.mockReset()
    listRequestsMock.mockReset()
    vi.mocked(activateCatalogProduct).mockReset()
    vi.mocked(deactivateCatalogProduct).mockReset()
    getTaxonomyOptionsMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    listProductsMock.mockResolvedValue([])
    listRequestsMock.mockResolvedValue([])
    getTaxonomyOptionsMock.mockResolvedValue({ categories: [], tags: [] })
  })

  function renderPage(initialEntry = "/", activeModules?: string[]) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <TestPermissionProvider permissions={["catalog.products.manage"]} activeModules={activeModules}>
          <CatalogProductsPage />
          <LocationProbe />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
  }

  it("badges restricted products next to the name and filters by visibility in More filters", async () => {
    const restricted = { ...PRODUCT, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Kit VIP", visibility: "Restricted" as const, grantedCustomerCount: 1, grantedGroupCount: 2 }
    listProductsMock.mockResolvedValue([PRODUCT, restricted])
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await within(table).findByText(i18n.t("catalog.products.badges.restricted", { count: 3 }))
    expect(within(table).queryByRole("columnheader", { name: i18n.t("catalog.products.visibilityFilter.title") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("catalog.products.moreFilters")) }))
    await user.click(await screen.findByRole("radio", { name: i18n.t("catalog.products.visibilityFilter.restricted") }))
    expect(within(productsTable()).queryByText("Raquete")).not.toBeInTheDocument()
    expect(within(productsTable()).getByText("Kit VIP")).toBeInTheDocument()
    expect(screen.getByTestId("more-filters-count")).toHaveTextContent("1")
    await user.click(screen.getByRole("button", { name: new RegExp(`^${i18n.t("catalog.products.visibilityFilter.title")}:`) }))
    expect(within(productsTable()).getByText("Raquete")).toBeInTheDocument()
    expect(screen.queryByTestId("more-filters-count")).not.toBeInTheDocument()
  })

  it("keeps requests out of the products list", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    listRequestsMock.mockResolvedValue([{
      id: "request-1", customerId: "customer-1", description: "Suporte para equipamento",
      quantity: 2, note: "Para sábado", status: "Submitted", createdAt: "2026-10-27T14:10:00Z", files: [],
    }])
    renderPage()
    await within(await screen.findByRole("table")).findByText(PRODUCT.name)
    expect(screen.queryByText("Suporte para equipamento")).not.toBeInTheDocument()
    expect(listRequestsMock).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
  })

  it("shows read-only requests in their own view with the existing loader", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    listRequestsMock.mockResolvedValue([{
      id: "request-1", customerId: "customer-1", description: "Suporte para equipamento",
      quantity: 2, note: "Para sábado", status: "Submitted", createdAt: "2026-10-27T14:10:00Z", files: [],
    }])
    render(
      <MemoryRouter initialEntries={["/catalogo/solicitacoes"]}>
        <TestPermissionProvider permissions={["catalog.products.read"]}>
          <CatalogProductsPage view="requests" />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText("Suporte para equipamento")).toBeInTheDocument()
    expect(screen.getByRole("table", { name: i18n.t("catalog.requests.title") })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: i18n.t("nav.catalog") })).not.toBeInTheDocument()
    expect(screen.queryByText(PRODUCT.name)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("catalog.products.create") })).not.toBeInTheDocument()
    expect(listRequestsMock).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
  })

  it("searches loaded products by name or code without reloading data", async () => {
    listProductsMock.mockResolvedValue([PRODUCT, { ...PRODUCT, id: "second", name: "Garrafa", code: "BEB-001" }])
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Garrafa")
    const search = screen.getByRole("searchbox", { name: i18n.t("catalog.staff.productsSearch") })
    await user.type(search, "beb-001")
    expect(within(productsTable()).getByText("Garrafa")).toBeInTheDocument()
    expect(within(productsTable()).queryByText(PRODUCT.name)).not.toBeInTheDocument()
    expect(listProductsMock).toHaveBeenCalledTimes(1)
    await user.clear(search)
    expect(within(productsTable()).getByText(PRODUCT.name)).toBeInTheDocument()
    await user.type(search, "does not exist")
    expect(screen.getByText(i18n.t("catalog.staff.noResults"))).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("filters by status chips with counts", async () => {
    listProductsMock.mockResolvedValue([PRODUCT, { ...PRODUCT, id: "inactive", name: "Item inativo", isActive: false }, { ...PRODUCT, id: "inc", name: "Sem preco", price: 0 }])
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Item inativo")
    const chip = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) })
    expect(chip(i18n.t("catalog.products.filterAll"))).toHaveTextContent("3")
    expect(chip(i18n.t("catalog.products.filterActive"))).toHaveTextContent("1")
    expect(chip(i18n.t("catalog.products.filterInactive"))).toHaveTextContent("1")
    expect(chip(i18n.t("catalog.products.filterIncomplete"))).toHaveTextContent("1")
    await user.click(chip(i18n.t("catalog.products.filterActive")))
    expect(within(productsTable()).getByText(PRODUCT.name)).toBeInTheDocument()
    expect(within(productsTable()).queryByText("Item inativo")).not.toBeInTheDocument()
    expect(within(productsTable()).queryByText("Sem preco")).not.toBeInTheDocument()
    await user.click(chip(i18n.t("catalog.products.filterInactive")))
    expect(within(productsTable()).getByText("Item inativo")).toBeInTheDocument()
    expect(within(productsTable()).queryByText(PRODUCT.name)).not.toBeInTheDocument()
    await user.click(chip(i18n.t("catalog.products.filterIncomplete")))
    expect(within(productsTable()).getByText("Sem preco")).toBeInTheDocument()
    expect(within(productsTable()).queryByText("Item inativo")).not.toBeInTheDocument()
    await user.click(chip(i18n.t("catalog.products.filterAll")))
    expect(within(productsTable()).getByText(PRODUCT.name)).toBeInTheDocument()
    expect(within(productsTable()).getByText("Item inativo")).toBeInTheDocument()
    expect(listProductsMock).toHaveBeenCalledTimes(1)
  })

  it("takes the incomplete badge and the Ativar hint from the API sale readiness", async () => {
    const notReady = { ...PRODUCT, id: "api", name: "Do servidor", isActive: false, saleReadiness: { ready: false, missing: ["RESOURCE", "PRICE"] } }
    const user = userEvent.setup()
    listProductsMock.mockResolvedValue([notReady])
    renderPage()
    const table = await screen.findByRole("table")
    const row = (await within(table).findByText("Do servidor")).closest("tr") as HTMLElement
    expect(within(row).getByText(i18n.t("catalog.products.statusIncomplete", { count: 2 }))).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: "Do servidor" }) }))
    const activate = await screen.findByRole("menuitem", { name: new RegExp(i18n.t("catalog.products.menuActivate")) })
    expect(activate).toHaveAttribute("aria-disabled", "true")
    expect(activate).toHaveTextContent("falta um recurso na agenda, preço maior que zero")
  })

  it("trusts a ready API verdict even when the local guess would say incomplete, and keeps Sob consulta complete", async () => {
    const ready = { ...PRODUCT, id: "ok", name: "Consulta ok", price: null, saleReadiness: { ready: true, missing: [] } }
    const guess = { ...PRODUCT, id: "g", name: "Sem verdict", price: 0 }
    listProductsMock.mockResolvedValue([ready, guess])
    renderPage()
    const table = await screen.findByRole("table")
    const readyRow = (await within(table).findByText("Consulta ok")).closest("tr") as HTMLElement
    const guessRow = within(table).getByText("Sem verdict").closest("tr") as HTMLElement
    expect(within(readyRow).getByText(i18n.t("catalog.products.active"))).toBeInTheDocument()
    expect(within(guessRow).getByText(i18n.t("catalog.products.statusIncomplete", { count: 1 }))).toBeInTheDocument()
  })

  it("shows one status column value per product and no separate published badge", async () => {
    listProductsMock.mockResolvedValue([PRODUCT, { ...PRODUCT, id: "inactive", name: "Item inativo", isActive: false }, { ...PRODUCT, id: "inc", name: "Sem preco", price: 0 }])
    renderPage()
    const table = await screen.findByRole("table")
    await within(table).findByText("Item inativo")
    const rowOf = (name: string) => within(table).getByText(name).closest("tr") as HTMLElement
    expect(within(rowOf(PRODUCT.name)).getByText(i18n.t("catalog.products.active"))).toBeInTheDocument()
    expect(within(rowOf("Item inativo")).getByText(i18n.t("catalog.products.inactive"))).toBeInTheDocument()
    expect(within(rowOf("Sem preco")).getByText(i18n.t("catalog.products.statusIncomplete", { count: 1 }))).toBeInTheDocument()
    expect(within(table).queryByText(i18n.t("assistant.status.published"))).not.toBeInTheDocument()
    expect(within(table).queryByText(i18n.t("assistant.status.draft"))).not.toBeInTheDocument()
  })

  it("shows no catalog tabs on the products page", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    renderPage()
    await within(await screen.findByRole("table")).findByText(PRODUCT.name)
    expect(screen.queryByRole("navigation", { name: i18n.t("nav.catalog") })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: new RegExp(i18n.t("catalog.requests.title")) })).not.toBeInTheDocument()
  })

  it("hides Categorias and Tags columns when no row has them and shows them otherwise", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const { unmount } = renderPage()
    await within(await screen.findByRole("table")).findByText(PRODUCT.name)
    expect(screen.queryByRole("columnheader", { name: i18n.t("taxonomy.categories") })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: i18n.t("taxonomy.tags") })).not.toBeInTheDocument()
    unmount()
    listProductsMock.mockResolvedValue([{
      ...PRODUCT,
      taxonomy: { categories: [{ id: "c1", name: "Quadras", slug: "quadras", parentId: null, icon: null, sortOrder: 0 }], tags: [] },
    }])
    renderPage()
    await within(await screen.findByRole("table")).findByText("Quadras")
    expect(screen.getByRole("columnheader", { name: i18n.t("taxonomy.categories") })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: i18n.t("taxonomy.tags") })).not.toBeInTheDocument()
  })

  it("combines search with the status filter", async () => {
    listProductsMock.mockResolvedValue([
      PRODUCT,
      { ...PRODUCT, id: "inactive", name: "Raquete velha", isActive: false },
      { ...PRODUCT, id: "other", name: "Garrafa", code: "BEB" },
    ])
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Garrafa")
    await user.type(screen.getByRole("searchbox", { name: i18n.t("catalog.staff.productsSearch") }), "raquete")
    await user.click(screen.getByRole("button", { name: new RegExp(`^${i18n.t("catalog.products.filterInactive")}`) }))
    expect(within(productsTable()).getByText("Raquete velha")).toBeInTheDocument()
    expect(within(productsTable()).queryByText("Raquete")).not.toBeInTheDocument()
    expect(within(productsTable()).queryByText("Garrafa")).not.toBeInTheDocument()
  })

  it("renders every product as a card too", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    renderPage()
    const cards = await screen.findByRole("list", { name: i18n.t("catalog.products.title") })
    expect(within(cards).getAllByRole("listitem")).toHaveLength(1)
    expect(within(cards).getByText(PRODUCT.name)).toBeInTheDocument()
    expect(within(cards).getByRole("button", { name: PRODUCT.name })).toBeInTheDocument()
    expect(within(cards).getByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: PRODUCT.name }) })).toBeInTheDocument()
  })

  it("shows the empty state when there are no products", async () => {
    listProductsMock.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(i18n.t("catalog.products.empty"))).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows the load error with a retry that reloads the products", async () => {
    listProductsMock.mockRejectedValueOnce(new Error("boom")).mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("boom")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("common.retry") }))
    expect(await within(await screen.findByRole("table")).findByText(PRODUCT.name)).toBeInTheDocument()
    expect(listProductsMock).toHaveBeenCalledTimes(2)
  })

  it("opens the editor from the name and offers a single row menu instead of loose buttons", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await within(table).findByText(PRODUCT.name)
    expect(within(table).queryByRole("link", { name: new RegExp(i18n.t("catalog.productWizard.open")) })).not.toBeInTheDocument()
    expect(within(table).queryByRole("button", { name: new RegExp(`^${i18n.t("common.edit")}`) })).not.toBeInTheDocument()
    expect(within(table).queryByRole("link", { name: new RegExp(i18n.t("catalog.products.quickEdit")) })).not.toBeInTheDocument()
    // name button + row menu only
    expect(within(table).getAllByRole("button")).toHaveLength(2)
    await user.click(within(table).getByRole("button", { name: PRODUCT.name }))
    expect(await screen.findByTestId("location")).toHaveTextContent(`/catalogo/produtos/${PRODUCT.id}`)
  })

  it("row menu (complete): Editar, Gerenciar acesso, then Desativar confirms before deactivating", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    vi.mocked(deactivateCatalogProduct).mockResolvedValue(undefined as never)
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await user.click(await within(table).findByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: PRODUCT.name }) }))
    expect(await screen.findByRole("menuitem", { name: i18n.t("catalog.products.menuEdit") })).toHaveAttribute("href", `/catalogo/produtos/${PRODUCT.id}/cadastro`)
    expect(screen.getByRole("menuitem", { name: i18n.t("catalog.products.menuAccess") })).toHaveAttribute("href", `/catalogo/produtos/${PRODUCT.id}/cadastro?passo=regras`)
    expect(screen.queryByRole("menuitem", { name: i18n.t("catalog.products.menuContinue") })).not.toBeInTheDocument()
    await user.click(screen.getByRole("menuitem", { name: i18n.t("catalog.products.menuDeactivate") }))
    expect(deactivateCatalogProduct).not.toHaveBeenCalled()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.products.deactivate") }))
    await waitFor(() => expect(deactivateCatalogProduct).toHaveBeenCalledWith(PRODUCT.id))
    expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastDeactivated"))
  })

  it("row menu (complete, inactive): Ativar produto acts at once", async () => {
    const inactive = { ...PRODUCT, id: "off", name: "Parada", isActive: false }
    listProductsMock.mockResolvedValue([inactive])
    vi.mocked(activateCatalogProduct).mockResolvedValue(undefined as never)
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await user.click(await within(table).findByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: "Parada" }) }))
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("catalog.products.menuActivate") }))
    await waitFor(() => expect(activateCatalogProduct).toHaveBeenCalledWith("off"))
  })

  it("row menu (incomplete): Concluir cadastro, Gerenciar acesso and a disabled Ativar produto with its hint", async () => {
    const incomplete = { ...PRODUCT, id: "inc", name: "Sem preco", price: 0, isActive: false }
    listProductsMock.mockResolvedValue([incomplete])
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await user.click(await within(table).findByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: "Sem preco" }) }))
    const proceed = await screen.findByRole("menuitem", { name: i18n.t("catalog.products.menuContinue") })
    expect(proceed.getAttribute("href")).toContain("/catalogo/produtos/inc/cadastro")
    expect(screen.getByRole("menuitem", { name: i18n.t("catalog.products.menuAccess") })).toBeInTheDocument()
    const activate = screen.getByRole("menuitem", { name: new RegExp(i18n.t("catalog.products.menuActivate")) })
    expect(activate).toHaveAttribute("aria-disabled", "true")
    expect(activate).toHaveTextContent(i18n.t("catalog.products.menuActivateHint"))
    await user.click(activate)
    expect(activateCatalogProduct).not.toHaveBeenCalled()
  })

  it("row menu without manage permission hides access and activation", async () => {
    const incomplete = { ...PRODUCT, id: "inc", name: "Sem preco", price: 0, isActive: false }
    listProductsMock.mockResolvedValue([incomplete])
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TestPermissionProvider permissions={["catalog.products.read"]}>
          <CatalogProductsPage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    const table = await screen.findByRole("table")
    await user.click(await within(table).findByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: "Sem preco" }) }))
    expect(await screen.findByRole("menuitem", { name: i18n.t("catalog.products.menuContinue") })).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: i18n.t("catalog.products.menuAccess") })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: new RegExp(i18n.t("catalog.products.menuActivate")) })).not.toBeInTheDocument()
  })

  it("Gerenciar acesso navigates to the access path; the trigger alone does not navigate", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await user.click(await within(table).findByRole("button", { name: i18n.t("catalog.products.rowMenu", { name: PRODUCT.name }) }))
    const item = await screen.findByRole("menuitem", { name: i18n.t("catalog.products.menuAccess") })
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/)
    await user.click(item)
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${PRODUCT.id}/cadastro`))
    expect(screen.getByTestId("search")).toHaveTextContent("?passo=regras")
    expect(productWizardPath(PRODUCT.id, "access")).toBe(`/catalogo/produtos/${PRODUCT.id}/cadastro?passo=regras`)
  })

  it("opens the editor when the row is clicked", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const table = await screen.findByRole("table")
    await user.click(within(table).getByText(PRODUCT.code!))
    expect(await screen.findByTestId("location")).toHaveTextContent(`/catalogo/produtos/${PRODUCT.id}`)
  })

  it("does not call a product without schedule incomplete for lacking resources, but does for a schedulable one", async () => {
    const withSchedule = { ...PRODUCT, id: "s1", name: "Com agenda" }
    const without = { ...PRODUCT, id: "s2", name: "Sem agenda", usesSchedule: false }
    listProductsMock.mockResolvedValue([withSchedule, without])
    renderPage("/", ["rentals"])
    const table = await screen.findByRole("table")
    const withRow = (await within(table).findByText("Com agenda")).closest("tr")!
    const withoutRow = within(table).getByText("Sem agenda").closest("tr")!
    await waitFor(() => expect(within(withRow).getByText(i18n.t("catalog.products.statusIncomplete", { count: 1 }))).toBeInTheDocument())
    expect(within(withoutRow).queryByText(i18n.t("catalog.products.statusIncomplete", { count: 1 }))).not.toBeInTheDocument()
    expect(within(withoutRow).queryByText(/^(Falta|Faltam)/)).not.toBeInTheDocument()
  })

  it("links Novo produto to the full page", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const create = await screen.findByRole("link", { name: i18n.t("catalog.products.create") })
    expect(create).toHaveAttribute("href", "/catalogo/produtos/cadastro")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(create)
    expect(screen.getByTestId("location")).toHaveTextContent("/catalogo/produtos/cadastro")
  })

  it("restores taxonomy filters from the URL and sends them with product requests", async () => {
    const category = "11111111-1111-4111-8111-111111111111"
    const tag = "22222222-2222-4222-8222-222222222222"
    renderPage(`/?category=${category}&tags=${tag}`)

    await waitFor(() => {
      expect(listProductsMock).toHaveBeenCalledWith(
        { category, tags: [tag] },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
  })

  it("shows a chip for the category in the URL and clears it on remove", async () => {
    const category = "11111111-1111-4111-8111-111111111111"
    getTaxonomyOptionsMock.mockResolvedValue({
      categories: [{ id: category, name: "Quadras", slug: "quadras", parentId: null, icon: null, sortOrder: 0 }],
      tags: [],
    })
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage(`/?category=${category}`)
    const chip = await screen.findByRole("button", { name: new RegExp(`${i18n.t("taxonomy.categories")}: Quadras`) })
    expect(screen.getByRole("button", { name: new RegExp(i18n.t("catalog.products.moreFilters")) })).toHaveAttribute("data-active", "true")
    await user.click(chip)
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(/^$/))
    expect(screen.queryByRole("button", { name: /Quadras/ })).not.toBeInTheDocument()
    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith(
      { category: null, tags: [] },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
  })

  it("shows a chip for the tag in the URL and clears it on remove", async () => {
    const tag = "22222222-2222-4222-8222-222222222222"
    getTaxonomyOptionsMock.mockResolvedValue({
      categories: [],
      tags: [{ id: tag, name: "Premium", slug: "premium" }],
    })
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage(`/?tags=${tag}`)
    const chip = await screen.findByRole("button", { name: new RegExp(`${i18n.t("taxonomy.tags")}: Premium`) })
    expect(screen.getByRole("button", { name: new RegExp(i18n.t("catalog.products.moreFilters")) })).toHaveAttribute("data-active", "true")
    await user.click(chip)
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(/^$/))
    expect(screen.queryByRole("button", { name: /Premium/ })).not.toBeInTheDocument()
    await waitFor(() => expect(listProductsMock).toHaveBeenLastCalledWith(
      { category: null, tags: [] },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
  })

  it("does not let an older taxonomy request overwrite the current products", async () => {
    const category = "11111111-1111-4111-8111-111111111111"
    const oldProduct = { ...PRODUCT, name: "Old result" }
    const currentProduct = { ...PRODUCT, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Current result" }
    let resolveOld: (products: CatalogProduct[]) => void = () => undefined
    listProductsMock
      .mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce([currentProduct])
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TestPermissionProvider permissions={["catalog.products.manage"]}>
          <CatalogProductsPage />
          <TaxonomyNavigation category={category} />
        </TestPermissionProvider>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: "Change taxonomy" }))
    await waitFor(() => expect(listProductsMock).toHaveBeenCalledTimes(2))

    resolveOld([oldProduct])
    expect(await within(await screen.findByRole("table")).findByText("Current result")).toBeInTheDocument()
    expect(screen.queryByText("Old result")).not.toBeInTheDocument()
  })
})

function LocationProbe() {
  const location = useLocation()
  return <><span data-testid="location">{location.pathname}</span><span data-testid="search">{location.search}</span></>
}

function TaxonomyNavigation({ category }: { category: string }) {
  const [, setSearchParams] = useSearchParams()
  return (
    <button type="button" onClick={() => setSearchParams({ category })}>
      Change taxonomy
    </button>
  )
}
