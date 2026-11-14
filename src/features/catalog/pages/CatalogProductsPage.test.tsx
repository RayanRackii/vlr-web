import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

  function renderPage(initialEntry = "/") {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <TestPermissionProvider permissions={["catalog.products.manage"]}>
          <CatalogProductsPage />
          <LocationProbe />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
  }

  it("badges restricted products and filters by visibility", async () => {
    const restricted = { ...PRODUCT, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Kit VIP", visibility: "Restricted" as const, grantedCustomerCount: 1, grantedGroupCount: 2 }
    listProductsMock.mockResolvedValue([PRODUCT, restricted])
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText(i18n.t("catalog.products.badges.restricted", { count: 3 }))
    await user.click(screen.getByRole("radio", { name: i18n.t("catalog.products.visibilityFilter.restricted") }))
    expect(within(productsTable()).queryByText("Raquete")).not.toBeInTheDocument()
    expect(within(productsTable()).getByText("Kit VIP")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("catalog.products.visibilityFilter.title")) }))
    expect(within(productsTable()).getByText("Raquete")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: i18n.t("catalog.products.visibilityFilter.restricted") })).toHaveAttribute("aria-checked", "false")
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
    expect(screen.getByRole("link", { name: new RegExp(i18n.t("catalog.requests.title")) })).toHaveAttribute("aria-current", "page")
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

  it("filters active products from the filter bar and removes the filter with its chip", async () => {
    listProductsMock.mockResolvedValue([PRODUCT, { ...PRODUCT, id: "inactive", name: "Item inativo", isActive: false }])
    const user = userEvent.setup()
    renderPage()
    await within(await screen.findByRole("table")).findByText("Item inativo")
    await user.click(screen.getByRole("radio", { name: i18n.t("catalog.products.active") }))
    expect(within(productsTable()).getByText(PRODUCT.name)).toBeInTheDocument()
    expect(within(productsTable()).queryByText("Item inativo")).not.toBeInTheDocument()
    expect(listProductsMock).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
    expect(within(productsTable()).queryByText(PRODUCT.name)).not.toBeInTheDocument()
    expect(within(productsTable()).getByText("Item inativo")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: new RegExp(`^${i18n.t("catalog.products.columns.status")}:`) }))
    expect(within(productsTable()).getByText(PRODUCT.name)).toBeInTheDocument()
    expect(within(productsTable()).getByText("Item inativo")).toBeInTheDocument()
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
    await user.click(screen.getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
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
    expect(within(cards).getByRole("button", { name: new RegExp(`^${i18n.t("common.edit")}`) })).toBeInTheDocument()
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

  it("pins product actions on tablets and keeps editing available", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const edit = await within(await screen.findByRole("table")).findByRole("button", { name: new RegExp(`^${i18n.t("common.edit")}`) })
    const actions = edit.closest("td")
    const header = screen.getByRole("columnheader", { name: i18n.t("catalog.products.columns.actions") })
    expect(actions).toHaveClass("md:max-lg:sticky", "md:max-lg:right-0", "md:max-lg:bg-card")
    const assistants = screen.getAllByRole("link", { name: new RegExp(`^${i18n.t("catalog.productWizard.open")}`) })
    expect(assistants.length).toBeGreaterThan(0)
    for (const assistant of assistants) {
      expect(assistant).toHaveAttribute("href", `/catalogo/produtos/${PRODUCT.id}/cadastro`)
    }
    expect(header).toHaveClass("md:max-lg:right-0")
    await user.click(edit)
    expect(await screen.findByTestId("location")).toHaveTextContent(
      `/catalogo/produtos/${PRODUCT.id}`,
    )
  })

  it("links Novo produto and quick edit to full pages", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const create = await screen.findByRole("link", { name: i18n.t("catalog.products.create") })
    expect(create).toHaveAttribute("href", "/catalogo/produtos/cadastro")
    const quick = within(productsTable()).getByRole("link", { name: new RegExp(`^${i18n.t("catalog.products.quickEdit")}`) })
    expect(quick).toHaveAttribute("href", `/catalogo/produtos/${PRODUCT.id}/cadastro?passo=precos`)
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
    expect(screen.getByRole("button", { name: i18n.t("taxonomy.categories") })).toHaveAttribute("data-active", "true")
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
    expect(screen.getByRole("button", { name: i18n.t("taxonomy.tags") })).toHaveAttribute("data-active", "true")
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
