import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogProductCreatePage } from "@/features/catalog/pages/CatalogProductCreatePage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/features/catalog/services/catalogService", () => ({
  createCatalogProduct: vi.fn(),
}))

import { createCatalogProduct } from "@/features/catalog/services/catalogService"

const createProductMock = vi.mocked(createCatalogProduct)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

const CREATED_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/catalogo/produtos/novo"]}>
      <TestPermissionProvider permissions={["catalog.products.manage"]}>
        <Routes>
          <Route path="/catalogo/produtos/novo" element={<CatalogProductCreatePage />} />
          <Route path="/catalogo/produtos" element={<h1>Lista</h1>} />
          <Route path="/catalogo/produtos/:id/assistente" element={<h1>Assistente</h1>} />
        </Routes>
        <LocationProbe />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

function replaceValue(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
}

describe("CatalogProductCreatePage", () => {
  beforeEach(() => {
    createProductMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    createProductMock.mockResolvedValue({
      id: CREATED_ID,
      name: "Raquete",
      code: "RAQ",
      description: null,
      price: null,
      currency: "BRL",
      isActive: true,
      createdAt: "2026-10-14T00:00:00.000Z",
      files: [],
      visibility: "Public",
      grantedCustomerCount: 0,
      grantedGroupCount: 0,
    })
  })

  it.each(["pt-BR", "en", "es"])("explains a blurred name beside the field in %s and starts clean again", async (locale) => {
    await i18n.changeLanguage(locale)
    try {
      const user = userEvent.setup()
      const view = renderPage()
      const message = i18n.t("catalog.products.validation.nameRequired")
      const name = screen.getByLabelText(i18n.t("catalog.products.form.name"))
      expect(screen.queryByText(message)).not.toBeInTheDocument()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      await user.click(name)
      await user.tab()
      expect(screen.getAllByText(message)).toHaveLength(1)
      expect(name).toHaveAttribute("aria-invalid", "true")
      await user.type(name, "Produto de teste")
      expect(screen.queryByText(message)).not.toBeInTheDocument()
      await user.click(screen.getByRole("link", { name: i18n.t("common.cancel") }))
      expect(await screen.findByRole("heading", { name: "Lista" })).toBeInTheDocument()
      view.unmount()
      renderPage()
      expect(screen.getByLabelText(i18n.t("catalog.products.form.name"))).toHaveValue("")
      expect(screen.queryByText(message)).not.toBeInTheDocument()
    } finally {
      await i18n.changeLanguage("pt-BR")
    }
  })

  it("creates an inactive product and opens the wizard", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByLabelText(i18n.t("catalog.products.form.name")), "Raquete")
    await user.click(screen.getByRole("radio", { name: i18n.t("catalog.products.inactive") }))
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.products.createContinue") }))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      name: "Raquete",
      status: "Inactive",
    })))
    expect(await screen.findByRole("heading", { name: "Assistente" })).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${CREATED_ID}/assistente`)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("keeps Criar e continuar disabled until the product schema passes", async () => {
    const user = userEvent.setup()
    renderPage()
    const save = () => screen.getByRole("button", { name: i18n.t("catalog.products.createContinue") })
    const cancel = screen.getByRole("link", { name: i18n.t("common.cancel") })
    expect(save()).toBeDisabled()
    expect(cancel).toBeEnabled()
    const name = screen.getByLabelText(i18n.t("catalog.products.form.name"))
    const code = screen.getByLabelText(i18n.t("catalog.products.form.code"))
    const price = screen.getByLabelText(i18n.t("catalog.products.form.price"))
    const currency = screen.getByLabelText(i18n.t("catalog.products.form.currency"))
    await user.type(name, "   ")
    expect(save()).toBeDisabled()
    await user.clear(name)
    await user.type(name, "Raquete")
    expect(code).toHaveValue("RAQ")
    expect(save()).toBeEnabled()
    replaceValue(name, "a".repeat(201))
    expect(save()).toBeDisabled()
    await user.clear(name)
    await user.type(name, "Raquete")
    replaceValue(code, "C".repeat(81))
    expect(save()).toBeDisabled()
    replaceValue(code, "C".repeat(80))
    expect(save()).toBeEnabled()
    await user.clear(currency)
    expect(save()).toBeDisabled()
    await user.type(currency, "BRL")
    expect(save()).toBeEnabled()
    await user.type(price, "abc")
    expect(save()).toBeEnabled()
    await user.click(save())
    expect(await screen.findByText(i18n.t("catalog.products.invalidPrice"))).toBeInTheDocument()
    expect(name).toHaveValue("Raquete")
    expect(price).toHaveValue("abc")
    expect(createProductMock).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it("keeps the entered values after a duplicate-code error and opens the wizard on retry", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => { throw new Error("missing reject") }
    createProductMock.mockImplementation(() => new Promise((_resolve, reject) => { rejectCreate = reject }))
    renderPage()
    const name = screen.getByLabelText(i18n.t("catalog.products.form.name"))
    const code = screen.getByLabelText(i18n.t("catalog.products.form.code"))
    const price = screen.getByLabelText(i18n.t("catalog.products.form.price"))
    await user.type(name, "Raquete")
    await user.type(price, "10,50")
    const save = screen.getByRole("button", { name: i18n.t("catalog.products.createContinue") })
    await user.click(save)
    await waitFor(() => expect(save).toBeDisabled())
    rejectCreate(new Error("Código já cadastrado."))
    await waitFor(() => expect(save).toBeEnabled())
    expect(toastError).toHaveBeenCalledWith("Código já cadastrado.")
    expect(name).toHaveValue("Raquete")
    expect(code).toHaveValue("RAQ")
    expect(price).toHaveValue("10,50")
    expect(screen.getByLabelText(i18n.t("catalog.products.form.currency"))).toHaveValue("BRL")
    expect(createProductMock).toHaveBeenCalledWith({
      name: "Raquete",
      code: "RAQ",
      description: null,
      price: 10.5,
      currency: "BRL",
      status: "Active",
    })
    createProductMock.mockResolvedValueOnce({
      id: CREATED_ID,
      name: "Raquete",
      code: "RAQ",
      description: null,
      price: 10.5,
      currency: "BRL",
      isActive: true,
      createdAt: "2026-10-14T00:00:00.000Z",
      files: [],
      visibility: "Public",
      grantedCustomerCount: 0,
      grantedGroupCount: 0,
    })
    await user.click(save)
    expect(await screen.findByRole("heading", { name: "Assistente" })).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith(i18n.t("catalog.products.toastCreated"))
  })

  it("hides the form without catalog.products.manage", () => {
    render(
      <MemoryRouter>
        <TestPermissionProvider permissions={["catalog.products.read"]}>
          <CatalogProductCreatePage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText(i18n.t("catalog.products.form.name"))).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: i18n.t("accessDenied.title") })).toBeInTheDocument()
  })
})
