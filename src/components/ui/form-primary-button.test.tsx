import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FormPrimaryButton } from "@/components/ui/form-primary-button"

describe("FormPrimaryButton", () => {
  it("is blocked when isValid is false", () => {
    render(<FormPrimaryButton isValid={false}>Salvar</FormPrimaryButton>)

    const button = screen.getByRole("button", { name: "Salvar" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-disabled", "true")
  })

  it("is enabled when the current state is valid", () => {
    render(<FormPrimaryButton isValid>Salvar</FormPrimaryButton>)

    const button = screen.getByRole("button", { name: "Salvar" })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute("aria-disabled", "true")
  })

  it("stays blocked while loading even if isValid is true", () => {
    render(
      <FormPrimaryButton isValid loading>
        Salvar
      </FormPrimaryButton>,
    )

    const button = screen.getByRole("button", { name: "Salvar" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-disabled", "true")
  })

  it("stays blocked when disabled is true even if isValid is true", () => {
    render(
      <FormPrimaryButton isValid disabled>
        Salvar
      </FormPrimaryButton>,
    )

    const button = screen.getByRole("button", { name: "Salvar" })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-disabled", "true")
  })
})
