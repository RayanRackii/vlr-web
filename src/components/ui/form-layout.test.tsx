import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FormGrid, FormRow, FormSection } from "./form-layout"

describe("FormRow", () => {
  it("wires label, hint and error ids into the control", () => {
    render(
      <FormRow label="Nome" htmlFor="n" hint="Dica" error="Obrigatório" required>
        <input />
      </FormRow>,
    )
    const input = screen.getByLabelText(/Nome/)
    expect(input).toHaveAttribute("id", "n")
    expect(input).toHaveAttribute("aria-describedby", "n-hint n-error")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Dica")).toHaveAttribute("id", "n-hint")
    const error = screen.getByRole("alert")
    expect(error).toHaveTextContent("Obrigatório")
    expect(error).toHaveAttribute("id", "n-error")
  })

  it("forces the control id to htmlFor and sets aria-required", () => {
    render(
      <FormRow label="Nome" htmlFor="n" required>
        <input id="other" />
      </FormRow>,
    )
    const input = screen.getByLabelText("Nome")
    expect(input).toHaveAttribute("id", "n")
    expect(input).toHaveAttribute("aria-required", "true")
  })

  it("omits describedby, invalid and alert when there is no hint or error", () => {
    render(
      <FormRow label="Nome" htmlFor="n">
        <input />
      </FormRow>,
    )
    const input = screen.getByLabelText("Nome")
    expect(input).not.toHaveAttribute("aria-describedby")
    expect(input).not.toHaveAttribute("aria-invalid")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("keeps an existing aria-describedby and spans two columns", () => {
    const { container } = render(
      <FormRow label="Nome" htmlFor="n" hint="Dica" span={2}>
        <input aria-describedby="extra" />
      </FormRow>,
    )
    expect(screen.getByLabelText("Nome")).toHaveAttribute("aria-describedby", "extra n-hint")
    expect(container.firstElementChild).toHaveClass("sm:col-span-2")
  })
})

describe("FormSection and FormGrid", () => {
  it("renders the title as an h2 with description and actions", () => {
    render(
      <FormSection title="Dados" description="Desc" actions={<button type="button">Add</button>}>
        <p>body</p>
      </FormSection>,
    )
    expect(screen.getByRole("heading", { level: 2, name: "Dados" })).toBeInTheDocument()
    expect(screen.getByText("Desc")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument()
  })

  it("uses two columns from sm only when asked", () => {
    const { container, rerender } = render(<FormGrid>x</FormGrid>)
    expect(container.firstElementChild).not.toHaveClass("sm:grid-cols-2")
    rerender(<FormGrid columns={2}>x</FormGrid>)
    expect(container.firstElementChild).toHaveClass("sm:grid-cols-2")
  })
})
