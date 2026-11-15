import { render, screen, waitFor, within } from "@testing-library/react"
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
    usesSchedule: true,
    createdAt: "2026-10-14T00:00:00.000Z",
    files: [],
    visibility: "Public",
    grantedCustomerCount: 0,
    grantedGroupCount: 0,
  })
})

function renderCreate(activeModules?: string[]) {
  return render(<MemoryRouter initialEntries={["/catalogo/produtos/cadastro"]}>
    <TestPermissionProvider permissions={["catalog.products.manage"]} activeModules={activeModules}>
      <Routes>
        <Route path="/catalogo/produtos/cadastro" element={<ProductCadastroCreatePage />} />
        <Route path="/catalogo/produtos/:id/cadastro" element={<h1>Cadastro salvo</h1>} />
        <Route path="/catalogo/produtos" element={<h1>Lista de produtos</h1>} />
      </Routes>
      <LocationProbe />
    </TestPermissionProvider>
  </MemoryRouter>)
}

const nameField = () => screen.getByRole("textbox", { name: "Nome do produto *" })

it("creates a draft from step 1 and continues to Categorias e tags of the new product", async () => {
  const user = userEvent.setup()
  renderCreate()
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeDisabled()
  await user.type(nameField(), "Raquete")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  expect(await screen.findByRole("heading", { name: "Cadastro salvo" })).toBeInTheDocument()
  expect(screen.getByTestId("location")).toHaveTextContent(`/catalogo/produtos/${CREATED_ID}/cadastro?passo=categorias`)
})

it("sends the product as Inactive with no price and the default currency", async () => {
  const user = userEvent.setup()
  renderCreate()
  await user.type(nameField(), "Raquete")
  await user.type(screen.getByRole("textbox", { name: "Descrição" }), "Para quadra")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await screen.findByRole("heading", { name: "Cadastro salvo" })
  expect(createProductMock).toHaveBeenCalledTimes(1)
  const body = createProductMock.mock.calls[0][0]
  expect(body).toMatchObject({ name: "Raquete", description: "Para quadra", price: null, currency: "BRL", status: "Inactive" })
  expect(body.code).toBeTruthy()
})

it("asks whether the product uses the schedule on rentals tenants (default Sim) and sends the choice", async () => {
  const user = userEvent.setup()
  renderCreate(["rentals"])
  expect(screen.getByRole("radio", { name: i18n.t("cadastro.product.usesScheduleYes") })).toHaveAttribute("aria-checked", "true")
  await user.type(nameField(), "Raquete")
  await user.click(screen.getByRole("radio", { name: i18n.t("cadastro.product.usesScheduleNo") }))
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await screen.findByRole("heading", { name: "Cadastro salvo" })
  expect(createProductMock.mock.calls[0][0]).toMatchObject({ usesSchedule: false })
  expect(screen.getByTestId("location")).toHaveTextContent("passo=categorias")
})

it("sends usesSchedule true by default and hides the question without the rentals module", async () => {
  const user = userEvent.setup()
  renderCreate()
  expect(screen.queryByRole("radio", { name: i18n.t("cadastro.product.usesScheduleNo") })).not.toBeInTheDocument()
  await user.type(nameField(), "Raquete")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await screen.findByRole("heading", { name: "Cadastro salvo" })
  expect(createProductMock.mock.calls[0][0]).toMatchObject({ usesSchedule: true })
})

it("Salvar e sair creates the draft and goes to the product list", async () => {
  const user = userEvent.setup()
  renderCreate()
  await user.type(nameField(), "Raquete")
  await user.click(screen.getByRole("button", { name: "Salvar e sair" }))
  expect(await screen.findByRole("heading", { name: "Lista de produtos" })).toBeInTheDocument()
  expect(createProductMock).toHaveBeenCalledTimes(1)
  expect(createProductMock.mock.calls[0][0]).toMatchObject({ status: "Inactive" })
})

it("Cancelar goes back to the list without creating anything", async () => {
  const user = userEvent.setup()
  renderCreate()
  await user.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(await screen.findByRole("heading", { name: "Lista de produtos" })).toBeInTheDocument()
  expect(createProductMock).not.toHaveBeenCalled()
})

it("keeps the values and stays on the page when the create call fails", async () => {
  createProductMock.mockRejectedValueOnce(new Error("falhou"))
  const user = userEvent.setup()
  renderCreate()
  await user.type(nameField(), "Raquete")
  await user.click(screen.getByRole("button", { name: "Salvar e continuar" }))
  await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId("location")).toHaveTextContent("/catalogo/produtos/cadastro")
  expect(nameField()).toHaveValue("Raquete")
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeEnabled())
})

it("blocks a double submit while the product is being created", async () => {
  let release: (value: Awaited<ReturnType<typeof createCatalogProduct>>) => void = () => undefined
  createProductMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
  const user = userEvent.setup()
  renderCreate()
  await user.type(nameField(), "Raquete")
  const next = screen.getByRole("button", { name: "Salvar e continuar" })
  await user.click(next)
  await user.click(next)
  await user.click(screen.getByRole("button", { name: "Salvar e sair" }))
  expect(createProductMock).toHaveBeenCalledTimes(1)
  release({ id: CREATED_ID } as never)
  await screen.findByRole("heading", { name: "Cadastro salvo" })
  expect(createProductMock).toHaveBeenCalledTimes(1)
})

it("shows the draft header, the read-only progress and no price or status fields", () => {
  renderCreate()
  expect(screen.getByRole("heading", { level: 1, name: "Novo produto" })).toBeInTheDocument()
  expect(screen.getByText("Rascunho")).toBeInTheDocument()
  expect(screen.getByText(i18n.t("cadastro.stage", { count: 1, total: 7 }))).toBeInTheDocument()
  const nav = screen.getByRole("navigation", { name: i18n.t("cadastro.steps") })
  for (const step of ["dados", "categorias", "agenda", "fila", "regras", "precos", "publicacao"]) {
    expect(within(nav).getAllByText(i18n.t(`cadastro.productSteps.${step}.title`)).length).toBeGreaterThan(0)
  }
  expect(within(nav).queryAllByRole("button")).toHaveLength(0)
  expect(screen.getByText("Valores e condições de cobrança serão definidos na etapa Preços.")).toBeInTheDocument()
  expect(screen.getByText("Use um código único para localizar o produto na sua operação.")).toBeInTheDocument()
  expect(screen.queryByLabelText(i18n.t("catalog.products.form.price"))).not.toBeInTheDocument()
  expect(screen.queryByLabelText(i18n.t("catalog.products.form.currency"))).not.toBeInTheDocument()
  expect(screen.queryByRole("radio")).not.toBeInTheDocument()
})

it("generates the internal code from the name until the user edits it", async () => {
  const user = userEvent.setup()
  renderCreate()
  await user.type(nameField(), "Raquete")
  const code = screen.getByRole("textbox", { name: "Código interno" })
  expect((code as HTMLInputElement).value).not.toBe("")
  await user.clear(code)
  await user.type(code, "RAQ-1")
  await user.type(nameField(), " pro")
  expect(code).toHaveValue("RAQ-1")
})
