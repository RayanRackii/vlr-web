import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createStepShell } from "@/features/assistant/testStepShell"
import { ProductWizardOfferStep } from "@/features/catalog/components/productWizard/ProductWizardOfferStep"
import type { CatalogProduct } from "@/features/catalog/schemas/catalogSchemas"
import { updateCatalogProduct } from "@/features/catalog/services/catalogService"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/catalog/services/catalogService", () => ({
  activateCatalogProduct: vi.fn(),
  deactivateCatalogProduct: vi.fn(),
  updateCatalogProduct: vi.fn(),
}))

const product = {
  id: "p1",
  name: "Kit",
  code: "KIT-1",
  description: "",
  price: 10,
  currency: "BRL",
  isActive: false,
  taxonomy: { categories: [], tags: [] },
} as unknown as CatalogProduct

function renderStep(mode?: "dados" | "precos", item: CatalogProduct = product) {
  const onSaved = vi.fn()
  const { StepShell, shell } = createStepShell()
  const view = render(<StepShell><ProductWizardOfferStep product={item} mode={mode} readOnly={false} onSaved={onSaved} /></StepShell>)
  return { shell, onSaved, ...view }
}

describe("ProductWizardOfferStep", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updateCatalogProduct).mockResolvedValue(product)
  })

  it("keeps its own Save button and the full form outside a shell", () => {
    render(<ProductWizardOfferStep product={product} readOnly={false} onSaved={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument()
    expect(screen.getByLabelText("Preço")).toBeInTheDocument()
    expect(screen.getByLabelText("Nome")).toBeInTheDocument()
    expect(screen.getByRole("radiogroup")).toBeInTheDocument()
  })

  it("dados mode shows only name, code and description and hides Save inside a shell", () => {
    renderStep("dados")
    expect(screen.getByLabelText("Nome do produto *")).toBeInTheDocument()
    expect(screen.getByLabelText("Código interno")).toBeInTheDocument()
    expect(screen.getByLabelText(/Descrição/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Preço")).not.toBeInTheDocument()
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
  })

  it("precos mode shows price and currency only", () => {
    renderStep("precos")
    expect(screen.getByLabelText("Preço")).toBeInTheDocument()
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument()
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
  })

  it("submit resolves true without a request when nothing changed", async () => {
    const { shell } = renderStep("dados")
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(true)
    expect(updateCatalogProduct).not.toHaveBeenCalled()
  })

  it("submit saves the edits and resolves true", async () => {
    const user = userEvent.setup()
    const { shell, onSaved } = renderStep("dados")
    await user.type(screen.getByLabelText("Nome do produto *"), " 2")
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(true)
    expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Kit 2", price: 10 }))
    expect(onSaved).toHaveBeenCalled()
  })

  it("submit resolves false with the error next to the field when validation fails", async () => {
    const user = userEvent.setup()
    const { shell } = renderStep("dados")
    await user.clear(screen.getByLabelText("Nome do produto *"))
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(false)
    expect(updateCatalogProduct).not.toHaveBeenCalled()
    expect(document.querySelector('[aria-invalid="true"]')).not.toBeNull()
  })

  it("submit resolves false and shows an inline alert when the request fails, keeping values", async () => {
    const user = userEvent.setup()
    vi.mocked(updateCatalogProduct).mockRejectedValue(new Error("Falha na API"))
    const { shell } = renderStep("precos")
    await user.clear(screen.getByLabelText("Preço"))
    await user.type(screen.getByLabelText("Preço"), "25")
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(false)
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha na API")
    expect(screen.getByLabelText("Preço")).toHaveValue("25")
  })

  it("submit rejects an invalid price in precos mode", async () => {
    const user = userEvent.setup()
    const { shell } = renderStep("precos")
    await user.clear(screen.getByLabelText("Preço"))
    await user.type(screen.getByLabelText("Preço"), "abc")
    let result: boolean | null = null
    await act(async () => { result = await shell.submit() })
    expect(result).toBe(false)
    await waitFor(() => expect(updateCatalogProduct).not.toHaveBeenCalled())
  })

  describe("price unit", () => {
    const withUnit = { ...product, priceUnit: "Hour" } as unknown as CatalogProduct

    it("precos mode shows the Cobrança select with the stored unit; dados mode hides it", () => {
      const { unmount } = renderStep("precos", withUnit)
      expect(screen.getByText("Cobrança")).toBeInTheDocument()
      expect(screen.getByTestId("price-unit-select")).toHaveTextContent("Por hora")
      unmount()
      renderStep("dados", withUnit)
      expect(screen.queryByTestId("price-unit-select")).not.toBeInTheDocument()
    })

    it("shows 'Sem unidade' when the product has no unit", () => {
      renderStep("precos")
      expect(screen.getByTestId("price-unit-select")).toHaveTextContent("Sem unidade")
    })

    it("precos save sends the unit (null clears it)", async () => {
      const user = userEvent.setup()
      const { shell } = renderStep("precos", withUnit)
      await user.type(screen.getByLabelText("Preço"), "5")
      await act(async () => { await shell.submit() })
      expect(updateCatalogProduct).toHaveBeenCalledWith("p1", expect.objectContaining({ priceUnit: "Hour" }))
    })

    it("precos save sends null when the product has no unit", async () => {
      const user = userEvent.setup()
      const { shell } = renderStep("precos")
      await user.type(screen.getByLabelText("Preço"), "5")
      await act(async () => { await shell.submit() })
      expect(vi.mocked(updateCatalogProduct).mock.calls[0][1]).toHaveProperty("priceUnit", null)
    })

    it("dados save never sends priceUnit so the stored value is kept", async () => {
      const user = userEvent.setup()
      const { shell } = renderStep("dados", withUnit)
      await user.type(screen.getByLabelText("Nome do produto *"), " 2")
      await act(async () => { await shell.submit() })
      expect(vi.mocked(updateCatalogProduct).mock.calls[0][1]).not.toHaveProperty("priceUnit")
    })
  })
})
