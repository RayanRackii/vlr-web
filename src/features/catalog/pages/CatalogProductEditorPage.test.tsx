import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogProductEditorPage } from "@/features/catalog/pages/CatalogProductEditorPage"
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
  getCatalogProduct: vi.fn(),
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
  getCatalogProduct,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"
import { getCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"

const getProductMock = vi.mocked(getCatalogProduct)
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

function renderPage(permissions: string[] = ["catalog.products.manage"]) {
  return render(
    <MemoryRouter initialEntries={[`/catalogo/produtos/${PRODUCT.id}`]}>
      <TestPermissionProvider permissions={permissions}>
        <Routes>
          <Route path="/catalogo/produtos/:id" element={<CatalogProductEditorPage />} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

function save() {
  return screen.getAllByRole("button", { name: i18n.t("catalog.products.save") })[0]!
}

describe("CatalogProductEditorPage", () => {
  beforeEach(() => {
    getProductMock.mockReset()
    updateProductMock.mockReset()
    getTaxonomyOptionsMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    getProductMock.mockResolvedValue(PRODUCT)
    getTaxonomyOptionsMock.mockResolvedValue({ categories: [], tags: [] })
  })

  it("loads the product into the form", async () => {
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    expect(name).toHaveValue("Raquete")
    expect(screen.getByLabelText(i18n.t("catalog.products.form.code"))).toHaveValue("RAQ")
    expect(getProductMock).toHaveBeenCalledWith(PRODUCT.id)
  })

  it("keeps Salvar disabled until a valid change is made", async () => {
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    expect(save()).toBeDisabled()

    await user.type(name, " pro")
    expect(save()).toBeEnabled()

    await user.clear(name)
    expect(save()).toBeDisabled()
    expect(updateProductMock).not.toHaveBeenCalled()
  })

  it("sends the same update payload as the dialog edit path", async () => {
    updateProductMock.mockResolvedValue({ ...PRODUCT, name: "Raquete pro" })
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.clear(name)
    await user.type(name, "Raquete pro")
    await user.click(save())

    await waitFor(() => {
      expect(updateProductMock).toHaveBeenCalledWith(PRODUCT.id, {
        name: "Raquete pro",
        code: "RAQ",
        description: "Carbono",
        price: 10.5,
        currency: "BRL",
      })
    })
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastUpdated"))
    })
  })

  it("keeps the entered values when the server rejects the save", async () => {
    updateProductMock.mockRejectedValue(new Error("Nome já cadastrado."))
    const user = userEvent.setup()
    renderPage()
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    await user.clear(name)
    await user.type(name, "Raquete pro")
    await user.click(save())

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Nome já cadastrado.")
    })
    expect(name).toHaveValue("Raquete pro")
    expect(save()).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("renders the files and access tabs", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(i18n.t("catalog.products.form.name"))

    await user.click(screen.getByRole("tab", { name: new RegExp(i18n.t("catalog.products.files.title")) }))
    expect(screen.getByLabelText(i18n.t("catalog.products.files.select"))).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: i18n.t("catalog.products.tabs.access") }))
    expect(
      await screen.findByText(i18n.t("catalog.products.access.history.title")),
    ).toBeInTheDocument()
  })

  it("is read-only without the manage permission", async () => {
    renderPage(["catalog.products.read"])
    const name = await screen.findByLabelText(i18n.t("catalog.products.form.name"))
    expect(name).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: i18n.t("catalog.products.save") }),
    ).not.toBeInTheDocument()
  })
})
