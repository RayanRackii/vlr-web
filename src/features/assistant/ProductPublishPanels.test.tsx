import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { ProductPublishSummary } from "./ProductPublishPanels"

function renderSummary(priceUnit: string | null) {
  render(
    <MemoryRouter>
      <ProductPublishSummary
        product={{ name: "Quadra", price: 45, currency: "BRL", priceUnit }}
        categoryNames={[]}
        usesAgenda={false}
        resourceNames={[]}
        visibility="Public"
        go={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe("ProductPublishSummary price", () => {
  it("includes the billing unit in the price row", () => {
    renderSummary("Hour")
    expect(screen.getByText(/R\$\s45,00 por hora/)).toBeInTheDocument()
  })

  it("shows only the amount without a unit", () => {
    renderSummary(null)
    expect(screen.getByText(/R\$\s45,00/)).toBeInTheDocument()
    expect(screen.queryByText(/por hora/)).not.toBeInTheDocument()
  })
})
