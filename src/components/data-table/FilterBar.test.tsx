import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FilterBar } from "@/components/data-table/FilterBar"

describe("FilterBar", () => {
  it("is a labelled section and renders filters and actions slots", () => {
    render(<FilterBar label="Filtros" filters={<div>slot filtros</div>} actions={<button type="button">Hoje</button>} />)
    expect(screen.getByRole("region", { name: "Filtros" })).toHaveTextContent("slot filtros")
    expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument()
  })

  it("calls onChange when searching", () => {
    const onChange = vi.fn()
    render(<FilterBar label="Filtros" search={{ value: "", onChange, placeholder: "Buscar", label: "Buscar reservas" }} />)
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar reservas" }), { target: { value: "ana" } })
    expect(onChange).toHaveBeenCalledWith("ana")
    expect(screen.getByPlaceholderText("Buscar")).toBeInTheDocument()
  })

  it("calls onRemove for a chip", () => {
    const onRemove = vi.fn()
    render(<FilterBar label="Filtros" chips={[{ label: "Confirmada", onRemove }]} />)
    fireEvent.click(screen.getByRole("button", { name: /Confirmada/ }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
