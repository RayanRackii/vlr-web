import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"

import { AdvancedCard } from "./advanced-card"

it("hides options until the toggle is pressed, then shows and hides again", async () => {
  const user = userEvent.setup()
  render(
    <AdvancedCard>
      <label>
        Internal code
        <input aria-label="Internal code" />
      </label>
    </AdvancedCard>,
  )
  const toggle = screen.getByRole("button", { name: "Mostrar opções" })
  expect(toggle).toHaveAttribute("aria-expanded", "false")
  expect(screen.getByLabelText("Internal code")).not.toBeVisible()

  await user.click(toggle)
  expect(screen.getByRole("button", { name: "Ocultar opções" })).toHaveAttribute("aria-expanded", "true")
  expect(screen.getByLabelText("Internal code")).toBeVisible()

  await user.click(screen.getByRole("button", { name: "Ocultar opções" }))
  expect(screen.getByLabelText("Internal code")).not.toBeVisible()
})

it("uses the default Avançado title", () => {
  render(<AdvancedCard><span>child</span></AdvancedCard>)
  expect(screen.getByText("Avançado")).toBeInTheDocument()
})
