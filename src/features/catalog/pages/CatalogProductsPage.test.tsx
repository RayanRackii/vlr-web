import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
  createCatalogProduct: vi.fn(),
  updateCatalogProduct: vi.fn(),
  activateCatalogProduct: vi.fn(),
  deactivateCatalogProduct: vi.fn(),
  deleteCatalogProductFile: vi.fn(),
  getCatalogProductFileUrl: vi.fn(),
  uploadCatalogProductFile: vi.fn(),
  getCatalogProductAccess: vi.fn().mockResolvedValue({ productId: "x", visibility: "Public", customerIds: [], groupIds: [], restrictedWithoutGrants: false }),
  getCatalogProductAccessHistory: vi.fn().mockResolvedValue([]),
  listCustomerGroups: vi.fn().mockResolvedValue([]),
  putCatalogProductAccess: vi.fn(),
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
  createCatalogProduct,
  listCatalogProducts,
  listProductRequests,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"
import { getCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"

const listProductsMock = vi.mocked(listCatalogProducts)
const listRequestsMock = vi.mocked(listProductRequests)
const createProductMock = vi.mocked(createCatalogProduct)
const updateProductMock = vi.mocked(updateCatalogProduct)
const getTaxonomyOptionsMock = vi.mocked(getCatalogTaxonomyOptions)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

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
    createProductMock.mockReset()
    updateProductMock.mockReset()
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

  async function openCreateSheet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      (await screen.findAllByRole("button", {
        name: i18n.t("catalog.products.create"),
      }))[0],
    )
    return screen.findByRole("dialog")
  }

  function replaceValue(element: HTMLElement, value: string) {
    fireEvent.change(element, { target: { value } })
  }

  it("badges restricted products and filters by visibility", async () => {
    const restricted = { ...PRODUCT, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Kit VIP", visibility: "Restricted" as const, grantedCustomerCount: 1, grantedGroupCount: 2 }
    listProductsMock.mockResolvedValue([PRODUCT, restricted])
    const user = userEvent.setup()
    renderPage()
    expect((await screen.findAllByText(i18n.t("catalog.products.badges.restricted", { count: 3 }))).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole("button", { name: i18n.t("catalog.products.visibilityFilter.title") })[0]!)
    await user.selectOptions(await screen.findByRole("combobox", { name: i18n.t("catalog.products.visibilityFilter.title") }), "Restricted")
    await waitFor(() => expect(screen.queryAllByText("Raquete")).toHaveLength(0))
    expect(screen.getAllByText("Kit VIP").length).toBeGreaterThan(0)
  })

  it("keeps requests out of the products list", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    listRequestsMock.mockResolvedValue([{
      id: "request-1", customerId: "customer-1", description: "Suporte para equipamento",
      quantity: 2, note: "Para sábado", status: "Submitted", createdAt: "2026-10-27T14:10:00Z", files: [],
    }])
    renderPage()
    await screen.findByText(PRODUCT.name)
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
    await screen.findByText("Garrafa")
    const search = screen.getByRole("searchbox", { name: i18n.t("catalog.staff.productsSearch") })
    await user.type(search, "beb-001")
    expect(screen.getByText("Garrafa")).toBeInTheDocument()
    expect(screen.queryByText(PRODUCT.name)).not.toBeInTheDocument()
    expect(listProductsMock).toHaveBeenCalledTimes(1)
    await user.clear(search)
    expect(screen.getByText(PRODUCT.name)).toBeInTheDocument()
    await user.type(search, "does not exist")
    expect(screen.getByText(i18n.t("catalog.staff.noResults"))).toBeInTheDocument()
  })

  it("filters active products separately from inactive products in the toolbar", async () => {
    listProductsMock.mockResolvedValue([PRODUCT, { ...PRODUCT, id: "inactive", name: "Item inativo", isActive: false }])
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Item inativo")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.products.columns.status") }))
    await user.selectOptions(screen.getByRole("combobox", { name: i18n.t("catalog.products.columns.status") }), "true")
    expect(screen.getByText(PRODUCT.name)).toBeInTheDocument()
    expect(screen.queryByText("Item inativo")).not.toBeInTheDocument()
    expect(listProductsMock).toHaveBeenCalledTimes(1)
  })

  it("pins product actions on tablets and keeps editing available", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()
    const edit = await screen.findByRole("button", { name: i18n.t("common.edit") })
    const actions = edit.closest("td")
    const header = screen.getByRole("columnheader", { name: i18n.t("catalog.products.columns.actions") })
    expect(actions).toHaveClass("md:max-lg:sticky", "md:max-lg:right-0", "md:max-lg:bg-card")
    expect(header).toHaveClass("md:max-lg:right-0")
    await user.click(edit)
    expect(await screen.findByTestId("location")).toHaveTextContent(
      `/catalogo/produtos/${PRODUCT.id}`,
    )
  })

  it.each(["pt-BR", "en", "es"])("shows no errors on open and explains a blurred name beside the field in %s", async (locale) => {
    await i18n.changeLanguage(locale)
    try {
      const user = userEvent.setup()
      renderPage()
      const dialog = await openCreateSheet(user)
      const message = i18n.t("catalog.products.validation.nameRequired")
      const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
      expect(within(dialog).queryByText(message)).not.toBeInTheDocument()
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
      expect(name).toHaveAttribute("aria-invalid", "false")
      expect(within(dialog).queryByLabelText(i18n.t("catalog.products.files.select"))).not.toBeInTheDocument()
      await user.click(name)
      await user.tab()
      expect(within(dialog).getAllByText(message)).toHaveLength(1)
      expect(name.closest('[data-slot="form-item"]')).toHaveTextContent(message)
      expect(name).toHaveAttribute("aria-invalid", "true")
      expect(name).toHaveAccessibleDescription(message)
      await user.type(name, "Produto de teste")
      expect(within(dialog).queryByText(message)).not.toBeInTheDocument()
      expect(name).toHaveAttribute("aria-invalid", "false")
      await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
      const reopened = await openCreateSheet(user)
      expect(within(reopened).queryByText(message)).not.toBeInTheDocument()
      expect(within(reopened).getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("")
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("creates an inactive product directly and opens its editor", async () => {
    createProductMock.mockResolvedValue({ ...PRODUCT, isActive: false })
    const user = userEvent.setup()
    renderPage()
    const dialog = await openCreateSheet(user)
    await user.type(within(dialog).getByLabelText(i18n.t("catalog.products.form.name")), "Raquete")
    await user.click(within(dialog).getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
    await user.click(within(dialog).getByRole("button", { name: i18n.t("catalog.products.createContinue") }))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: "Raquete", status: "Inactive" })))
    expect(deactivateCatalogProduct).not.toHaveBeenCalled()
    expect(await screen.findByTestId("location")).toHaveTextContent(`/catalogo/produtos/${PRODUCT.id}`)
  })

  it("preserves inactive creation values after a failed create and permits retry", async () => {
    createProductMock.mockRejectedValueOnce(new Error("Create failed"))
      .mockResolvedValueOnce({ ...PRODUCT, isActive: false })
    const user = userEvent.setup()
    renderPage()
    const dialog = await openCreateSheet(user)
    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    await user.type(name, "Raquete")
    await user.click(within(dialog).getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
    const submit = within(dialog).getByRole("button", { name: i18n.t("catalog.products.createContinue") })
    await user.click(submit)
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Create failed"))
    expect(name).toBeEnabled()
    expect(name).toHaveValue("Raquete")
    expect(within(dialog).getByRole("radio", { name: i18n.t("catalog.products.inactive") })).toBeChecked()
    await user.click(submit)
    await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(2))
    expect(createProductMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "Inactive" }))
    expect(deactivateCatalogProduct).not.toHaveBeenCalled()
  })

  it("keeps Criar e continuar disabled until the product schema passes and leaves Cancelar and Fechar free", async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openCreateSheet(user)

    const save = () =>
      within(dialog).getByRole("button", {
        name: i18n.t("catalog.products.createContinue"),
      })
    const cancel = within(dialog).getByRole("button", {
      name: i18n.t("common.cancel"),
    })
    const close = within(dialog).getByRole("button", {
      name: "Close",
    })
    expect(save()).toBeDisabled()
    expect(cancel).toBeEnabled()
    expect(close).toBeEnabled()

    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    const code = within(dialog).getByLabelText(i18n.t("catalog.products.form.code"))
    const price = within(dialog).getByLabelText(i18n.t("catalog.products.form.price"))
    const currency = within(dialog).getByLabelText(
      i18n.t("catalog.products.form.currency"),
    )

    await user.type(name, "   ")
    expect(save()).toBeDisabled()
    expect(cancel).toBeEnabled()
    expect(createProductMock).not.toHaveBeenCalled()

    await user.clear(name)
    await user.type(name, "Raquete")
    expect(code).toHaveValue("RAQ")
    expect(save()).toBeEnabled()
    expect(cancel).toBeEnabled()
    expect(close).toBeEnabled()

    replaceValue(name, "a".repeat(201))
    expect(save()).toBeDisabled()

    await user.clear(name)
    await user.type(name, "Raquete")
    expect(save()).toBeEnabled()

    replaceValue(code, "C".repeat(81))
    expect(save()).toBeDisabled()
    expect(cancel).toBeEnabled()
    replaceValue(code, "C".repeat(80))
    expect(save()).toBeEnabled()

    await user.clear(currency)
    expect(save()).toBeDisabled()
    expect(close).toBeEnabled()
    await user.type(currency, "BRL")
    expect(save()).toBeEnabled()

    await user.type(price, "abc")
    expect(save()).toBeEnabled()
    expect(cancel).toBeEnabled()
    await user.click(save())

    expect(
      await within(dialog).findByText(i18n.t("catalog.products.invalidPrice")),
    ).toBeInTheDocument()
    expect(name).toHaveValue("Raquete")
    expect(price).toHaveValue("abc")
    expect(save()).toBeEnabled()
    expect(cancel).toBeEnabled()
    expect(close).toBeEnabled()
    expect(createProductMock).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("re-enables Criar e continuar after a duplicate-code error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createProductMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject
        }),
    )
    renderPage()
    const dialog = await openCreateSheet(user)

    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    const code = within(dialog).getByLabelText(i18n.t("catalog.products.form.code"))
    const price = within(dialog).getByLabelText(i18n.t("catalog.products.form.price"))
    await user.type(name, "Raquete")
    await user.type(price, "10,50")

    const save = within(dialog).getByRole("button", {
      name: i18n.t("catalog.products.createContinue"),
    })
    expect(save).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("catalog.products.createContinue"),
        }),
      ).toBeDisabled()
    })

    rejectCreate(new Error("Código já cadastrado."))

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("catalog.products.createContinue"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Código já cadastrado.")
    expect(name).toHaveValue("Raquete")
    expect(code).toHaveValue("RAQ")
    expect(price).toHaveValue("10,50")
    expect(
      within(dialog).getByLabelText(i18n.t("catalog.products.form.currency")),
    ).toHaveValue("BRL")
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(createProductMock).toHaveBeenCalledTimes(1)
    expect(createProductMock).toHaveBeenCalledWith({
      name: "Raquete",
      code: "RAQ",
      description: null,
      price: 10.5,
      currency: "BRL",
      status: "Active",
    })

    createProductMock.mockResolvedValueOnce({
      ...PRODUCT,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      description: null,
    })
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("catalog.products.createContinue"),
      }),
    )
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastCreated"))
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(createProductMock).toHaveBeenCalledTimes(2)
  })

  it("creates from the sheet with the Portuguese product toast and opens the editor", async () => {
    const createdId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    createProductMock.mockResolvedValue({ ...PRODUCT, id: createdId })
    const user = userEvent.setup()
    renderPage()
    const sheet = await openCreateSheet(user)
    await user.type(within(sheet).getByLabelText(i18n.t("catalog.products.form.name")), "Raquete")
    await user.click(within(sheet).getByRole("button", { name: i18n.t("catalog.products.createContinue") }))
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${createdId}`))
    expect(createProductMock).toHaveBeenCalledTimes(1)
    expect(createProductMock).toHaveBeenCalledWith({ name: "Raquete", code: "RAQ", description: null, price: null, currency: "BRL", status: "Active" })
    expect(toastSuccess).toHaveBeenCalledWith("Produto criado.")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("quick edits name, price and status while preserving the other product fields", async () => {
    listProductsMock.mockResolvedValue([{
      ...PRODUCT,
      taxonomy: { categories: [{ id: "category-1", name: "Equipamento", slug: "equipamento", parentId: null, icon: null, sortOrder: 0 }], tags: [{ id: "tag-1", name: "Carbono", slug: "carbono" }] },
    }])
    updateProductMock.mockResolvedValue({ ...PRODUCT, name: "Raquete pro", price: 25.5 })
    vi.mocked(deactivateCatalogProduct).mockResolvedValue({ ...PRODUCT, isActive: false })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.products.quickEdit") }))
    const sheet = screen.getByRole("dialog")
    replaceValue(within(sheet).getByLabelText(i18n.t("catalog.products.form.name")), "Raquete pro")
    replaceValue(within(sheet).getByLabelText(i18n.t("catalog.products.form.price")), "25,50")
    await user.click(within(sheet).getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
    await user.click(within(sheet).getByRole("button", { name: i18n.t("common.save") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(updateProductMock).toHaveBeenCalledTimes(1)
    expect(updateProductMock).toHaveBeenCalledWith(PRODUCT.id, {
      name: "Raquete pro", code: "RAQ", description: "Carbono", price: 25.5, currency: "BRL",
      taxonomy: { categoryIds: ["category-1"], tagIds: ["tag-1"] },
    })
    expect(deactivateCatalogProduct).toHaveBeenCalledExactlyOnceWith(PRODUCT.id)
    expect(updateProductMock.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deactivateCatalogProduct).mock.invocationCallOrder[0]!)
    expect(activateCatalogProduct).not.toHaveBeenCalled()
  })

  it("keeps quick edit values and permits retry after a server error", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    updateProductMock.mockRejectedValue(new Error("Não foi possível salvar."))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: i18n.t("catalog.products.quickEdit") }))
    const sheet = screen.getByRole("dialog")
    const name = within(sheet).getByLabelText(i18n.t("catalog.products.form.name"))
    const price = within(sheet).getByLabelText(i18n.t("catalog.products.form.price"))
    replaceValue(name, "Raquete pro")
    replaceValue(price, "25,50")
    const inactive = within(sheet).getByRole("radio", { name: i18n.t("catalog.products.inactive") })
    await user.click(inactive)
    const save = within(sheet).getByRole("button", { name: i18n.t("common.save") })
    await user.click(save)
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Não foi possível salvar."))
    expect(sheet).toBeVisible()
    expect(name).toHaveValue("Raquete pro")
    expect(price).toHaveValue("25,50")
    expect(inactive).toBeChecked()
    expect(save).toBeEnabled()
    expect(updateProductMock).toHaveBeenCalledTimes(1)
    expect(deactivateCatalogProduct).not.toHaveBeenCalled()
    expect(activateCatalogProduct).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
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
    expect(await screen.findByText("Current result")).toBeInTheDocument()
    expect(screen.queryByText("Old result")).not.toBeInTheDocument()
  })
})

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname}</span>
}

function TaxonomyNavigation({ category }: { category: string }) {
  const [, setSearchParams] = useSearchParams()
  return (
    <button type="button" onClick={() => setSearchParams({ category })}>
      Change taxonomy
    </button>
  )
}
