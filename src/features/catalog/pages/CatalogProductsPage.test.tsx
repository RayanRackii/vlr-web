import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useSearchParams } from "react-router-dom"
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
}))

vi.mock("@/features/taxonomy/services/taxonomyService", () => ({
  getCatalogTaxonomyOptions: vi.fn(),
}))

import {
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
}

describe("CatalogProductsPage validity gate", () => {
  beforeEach(() => {
    listProductsMock.mockReset()
    listRequestsMock.mockReset()
    createProductMock.mockReset()
    updateProductMock.mockReset()
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
        </TestPermissionProvider>
      </MemoryRouter>,
    )
  }

  async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
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
    expect(within(await screen.findByRole("dialog")).getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue(PRODUCT.name)
  })

  it.each(["pt-BR", "en", "es"])("shows no errors on open and explains a blurred name beside the field in %s", async (locale) => {
    await i18n.changeLanguage(locale)
    try {
      const user = userEvent.setup()
      renderPage()
      const dialog = await openCreateDialog(user)
      const message = i18n.t("catalog.products.validation.nameRequired")
      const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
      expect(within(dialog).queryByText(message)).not.toBeInTheDocument()
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument()
      expect(name).toHaveAttribute("aria-invalid", "false")
      const files = within(dialog).getByText(i18n.t("catalog.products.files.title"))
      expect(files).toBeVisible()
      expect(within(dialog).getByLabelText(i18n.t("catalog.products.files.select"))).toBeEnabled()
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
      const reopened = await openCreateDialog(user)
      expect(within(reopened).queryByText(message)).not.toBeInTheDocument()
      expect(within(reopened).getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("")
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("keeps Salvar disabled until the product schema passes and leaves Cancelar and Fechar free", async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openCreateDialog(user)

    const save = () =>
      within(dialog).getByRole("button", {
        name: i18n.t("catalog.products.save"),
      })
    const cancel = within(dialog).getByRole("button", {
      name: i18n.t("common.cancel"),
    })
    const close = within(dialog).getByRole("button", {
      name: i18n.t("common.close"),
    })
    expect(save()).toBeDisabled()
    expect(cancel).toBeEnabled()
    expect(close).toBeEnabled()

    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    const code = within(dialog).getByLabelText(i18n.t("catalog.products.form.code"))
    const description = within(dialog).getByLabelText(
      i18n.t("catalog.products.form.description"),
    )
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

    replaceValue(description, "d".repeat(4001))
    expect(save()).toBeDisabled()
    await user.clear(description)
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

  it("re-enables Salvar after a duplicate-code error and keeps the entered values", async () => {
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
    const dialog = await openCreateDialog(user)

    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    const code = within(dialog).getByLabelText(i18n.t("catalog.products.form.code"))
    const description = within(dialog).getByLabelText(
      i18n.t("catalog.products.form.description"),
    )
    const price = within(dialog).getByLabelText(i18n.t("catalog.products.form.price"))
    await user.type(name, "Raquete")
    await user.type(description, "Carbono")
    await user.type(price, "10,50")

    const save = within(dialog).getByRole("button", {
      name: i18n.t("catalog.products.save"),
    })
    expect(save).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("catalog.products.saving"),
        }),
      ).toBeDisabled()
    })

    rejectCreate(new Error("Código já cadastrado."))

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("catalog.products.save"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Código já cadastrado.")
    expect(name).toHaveValue("Raquete")
    expect(code).toHaveValue("RAQ")
    expect(description).toHaveValue("Carbono")
    expect(price).toHaveValue("10,50")
    expect(
      within(dialog).getByLabelText(i18n.t("catalog.products.form.currency")),
    ).toHaveValue("BRL")
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.close") }),
    ).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(createProductMock).toHaveBeenCalledTimes(1)
    expect(createProductMock).toHaveBeenCalledWith({
      name: "Raquete",
      code: "RAQ",
      description: "Carbono",
      price: 10.5,
      currency: "BRL",
    })

    createProductMock.mockResolvedValueOnce({
      ...PRODUCT,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      description: "Carbono",
    })
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("catalog.products.save"),
      }),
    )
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastCreated"))
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(createProductMock).toHaveBeenCalledTimes(2)
  })

  it("keeps Salvar disabled when editing until the schema passes again", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("Raquete")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("common.edit") }))

    const dialog = await screen.findByRole("dialog")
    const save = () =>
      within(dialog).getByRole("button", {
        name: i18n.t("catalog.products.save"),
      })
    const cancel = within(dialog).getByRole("button", {
      name: i18n.t("common.cancel"),
    })
    const close = within(dialog).getByRole("button", {
      name: i18n.t("common.close"),
    })
    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    const code = within(dialog).getByLabelText(i18n.t("catalog.products.form.code"))
    expect(name).toHaveValue("Raquete")
    expect(code).toHaveValue("RAQ")
    expect(save()).toBeEnabled()
    expect(cancel).toBeEnabled()
    expect(close).toBeEnabled()

    await user.clear(name)
    expect(save()).toBeDisabled()
    await user.type(name, "   ")
    expect(save()).toBeDisabled()
    expect(updateProductMock).not.toHaveBeenCalled()
    expect(cancel).toBeEnabled()

    await user.clear(name)
    await user.type(name, "Raquete pro")
    expect(code).toHaveValue("RAQ")
    expect(save()).toBeEnabled()

    replaceValue(code, "C".repeat(81))
    expect(save()).toBeDisabled()
    expect(close).toBeEnabled()
    replaceValue(code, "RAQ")
    expect(save()).toBeEnabled()
    expect(cancel).toBeEnabled()
  })

  it("re-enables Salvar after an edit server error and keeps the entered values", async () => {
    listProductsMock.mockResolvedValue([PRODUCT])
    const user = userEvent.setup()
    let rejectUpdate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    updateProductMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectUpdate = reject
        }),
    )
    renderPage()
    expect(await screen.findByText("Raquete")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("common.edit") }))

    const dialog = await screen.findByRole("dialog")
    const name = within(dialog).getByLabelText(i18n.t("catalog.products.form.name"))
    const description = within(dialog).getByLabelText(
      i18n.t("catalog.products.form.description"),
    )
    const price = within(dialog).getByLabelText(i18n.t("catalog.products.form.price"))
    await user.clear(name)
    await user.type(name, "Raquete pro")
    await user.clear(description)
    await user.type(description, "Carbono leve")
    await user.clear(price)
    await user.type(price, "12,00")

    const save = within(dialog).getByRole("button", {
      name: i18n.t("catalog.products.save"),
    })
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("catalog.products.saving"),
        }),
      ).toBeDisabled()
    })

    rejectUpdate(new Error("Nome já cadastrado."))

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("catalog.products.save"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Nome já cadastrado.")
    expect(name).toHaveValue("Raquete pro")
    expect(
      within(dialog).getByLabelText(i18n.t("catalog.products.form.code")),
    ).toHaveValue("RAQ")
    expect(description).toHaveValue("Carbono leve")
    expect(price).toHaveValue("12,00")
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.close") }),
    ).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(updateProductMock).toHaveBeenCalledTimes(1)
    expect(updateProductMock).toHaveBeenCalledWith(PRODUCT.id, {
      name: "Raquete pro",
      code: "RAQ",
      description: "Carbono leve",
      price: 12,
      currency: "BRL",
    })

    updateProductMock.mockResolvedValueOnce({
      ...PRODUCT,
      name: "Raquete pro",
      description: "Carbono leve",
      price: 12,
    })
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("catalog.products.save"),
      }),
    )
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastUpdated"))
    })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(name).toHaveValue("Raquete pro")
    expect(description).toHaveValue("Carbono leve")
    expect(price).toHaveValue("12,00")
    expect(updateProductMock).toHaveBeenCalledTimes(2)
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

function TaxonomyNavigation({ category }: { category: string }) {
  const [, setSearchParams] = useSearchParams()
  return (
    <button type="button" onClick={() => setSearchParams({ category })}>
      Change taxonomy
    </button>
  )
}
