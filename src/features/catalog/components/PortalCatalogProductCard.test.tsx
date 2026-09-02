import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { PortalCatalogProductCard } from "@/features/catalog/components/PortalCatalogProductCard"
import type { PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111"
const SUBDOMAIN = "clube"

function product(overrides: Partial<PortalProduct> = {}): PortalProduct {
  return {
    id: PRODUCT_ID,
    name: "Cadeira de praia",
    code: "CAD-01",
    description: null,
    price: 42.5,
    currency: "BRL",
    files: [],
    ...overrides,
  }
}

function renderCard(
  overrides: {
    product?: PortalProduct
    quantity?: number
    onQuantityChange?: (quantity: number) => void
    onAdd?: () => void
  } = {},
) {
  const onQuantityChange = overrides.onQuantityChange ?? vi.fn()
  const onAdd = overrides.onAdd ?? vi.fn()

  render(
    <MemoryRouter>
      <PortalCatalogProductCard
        product={overrides.product ?? product()}
        subdomain={SUBDOMAIN}
        quantity={overrides.quantity ?? 1}
        onQuantityChange={onQuantityChange}
        onAdd={onAdd}
        primary="#1a6b4a"
      />
    </MemoryRouter>,
  )

  return { onQuantityChange, onAdd }
}

describe("PortalCatalogProductCard", () => {
  it("renders code, name and price", () => {
    renderCard()

    expect(screen.getByText("CAD-01")).toBeInTheDocument()
    expect(screen.getByText("Cadeira de praia")).toBeInTheDocument()
    expect(screen.getByText(/42,50/)).toBeInTheDocument()
  })

  it("shows a placeholder and no img when the product has zero images", () => {
    renderCard()

    expect(screen.queryByRole("img", { name: "Cadeira de praia" })).not.toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
    expect(screen.getByLabelText("Sem imagem")).toBeInTheDocument()
  })

  it("puts the zero-image placeholder inside a link to the product detail", () => {
    renderCard()

    const expected = tenantPortalPath(SUBDOMAIN, `catalogo/${PRODUCT_ID}`)
    const placeholderLink = screen.getByRole("link", { name: "Sem imagem" })
    expect(placeholderLink).toHaveAttribute("href", expected)
    expect(placeholderLink).not.toContainElement(
      screen.getByRole("heading", { name: "Cadeira de praia" }),
    )
  })

  it("wraps a single image in a detail link without next or previous controls", () => {
    renderCard({
      product: product({
        files: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            fileName: "cadeira.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 1200,
            url: "https://cdn.example/cadeira.jpg",
          },
        ],
      }),
    })

    const expected = tenantPortalPath(SUBDOMAIN, `catalogo/${PRODUCT_ID}`)
    const img = screen.getByRole("img", { name: "Cadeira de praia" })
    expect(img).toHaveAttribute("src", "https://cdn.example/cadeira.jpg")
    const imageLink = img.closest("a")
    expect(imageLink).toHaveAttribute("href", expected)
    expect(imageLink).not.toContainElement(
      screen.getByRole("heading", { name: "Cadeira de praia" }),
    )
    expect(
      screen.queryByRole("button", { name: "Imagem anterior" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Próxima imagem" }),
    ).not.toBeInTheDocument()
  })

  it("calls onAdd when Adicionar is clicked", async () => {
    const user = userEvent.setup()
    const { onAdd } = renderCard()

    await user.click(screen.getByRole("button", { name: "Adicionar" }))

    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it("increases quantity with plus and disables minus at 1", async () => {
    const user = userEvent.setup()
    const { onQuantityChange } = renderCard({ quantity: 1 })

    expect(
      screen.getByRole("button", { name: "Diminuir quantidade" }),
    ).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Aumentar quantidade" }))

    expect(onQuantityChange).toHaveBeenCalledWith(2)
  })

  it("links the product name to the catalog detail path", () => {
    renderCard()

    const expected = tenantPortalPath(SUBDOMAIN, `catalogo/${PRODUCT_ID}`)
    expect(
      screen.getByRole("heading", { name: "Cadeira de praia" }).closest("a"),
    ).toHaveAttribute("href", expected)
  })

  it("does not wrap Adicionar in a product link", () => {
    renderCard()

    const add = screen.getByRole("button", { name: "Adicionar" })
    expect(add.closest("a")).toBeNull()
    expect(
      screen.queryByRole("link", { name: "Adicionar" }),
    ).not.toBeInTheDocument()
  })
})
