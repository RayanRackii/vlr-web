import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

import {
  createCatalogProduct,
  listCatalogProducts,
  listProductRequests,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"

const listProductsMock = vi.mocked(listCatalogProducts)
const listRequestsMock = vi.mocked(listProductRequests)
const createProductMock = vi.mocked(createCatalogProduct)
const updateProductMock = vi.mocked(updateCatalogProduct)
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
    toastSuccess.mockReset()
    toastError.mockReset()
    listProductsMock.mockResolvedValue([])
    listRequestsMock.mockResolvedValue([])
  })

  function renderPage() {
    return render(
      <TestPermissionProvider permissions={["catalog.products.manage"]}>
        <CatalogProductsPage />
      </TestPermissionProvider>,
    )
  }

  async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("catalog.products.create"),
      }),
    )
    return screen.findByRole("dialog")
  }

  function replaceValue(element: HTMLElement, value: string) {
    fireEvent.change(element, { target: { value } })
  }

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
})
