import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import { QuickEditSheet } from "./quick-edit-sheet"

function setup(props: Partial<React.ComponentProps<typeof QuickEditSheet>> = {}) {
  const onSave = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <QuickEditSheet
      open
      onOpenChange={onOpenChange}
      title="Quick edit"
      onSave={onSave}
      fullEditHref="/full"
      {...props}
    >
      <input aria-label="Name" />
    </QuickEditSheet>,
  )
  return { onSave, onOpenChange }
}

it("renders the title, children and full-edit link when open", () => {
  setup()
  expect(screen.getByText("Quick edit")).toBeInTheDocument()
  expect(screen.getByLabelText("Name")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /edição completa/ })).toHaveAttribute("href", "/full")
})

it("fires onSave from the footer Salvar button", async () => {
  const user = userEvent.setup()
  const { onSave } = setup()
  await user.click(screen.getByRole("button", { name: "Salvar" }))
  expect(onSave).toHaveBeenCalledTimes(1)
})

it("requests close from Cancelar", async () => {
  const user = userEvent.setup()
  const { onOpenChange } = setup()
  await user.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
})
