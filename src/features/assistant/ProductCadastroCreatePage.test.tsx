import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"

import { ProductCadastroCreatePage } from "@/features/assistant/ProductCadastroCreatePage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/catalog/services/catalogService", () => ({
  createCatalogProduct: vi.fn(),
}))

import { createCatalogProduct } from "@/features/catalog/services/catalogService"

const createProductMock = vi.mocked(createCatalogProduct)
const CREATED_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

beforeEach(() => {
  createProductMock.mockReset()
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

it("creates from the full cadastro page and opens the saved product", async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={["/catalogo/produtos/cadastro"]}>
    <TestPermissionProvider permissions={["catalog.products.manage"]}>
      <Routes>
        <Route path="/catalogo/produtos/cadastro" element={<ProductCadastroCreatePage />} />
        <Route path="/catalogo/produtos/:id/cadastro" element={<h1>Cadastro salvo</h1>} />
      </Routes>
      <LocationProbe />
    </TestPermissionProvider>
  </MemoryRouter>)
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  await user.type(screen.getByLabelText(i18n.t("catalog.products.form.name")), "Raquete")
  await user.click(screen.getByRole("button", { name: "Continuar" }))
  expect(await screen.findByRole("heading", { name: "Cadastro salvo" })).toBeInTheDocument()
  expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${CREATED_ID}/cadastro`)
})
