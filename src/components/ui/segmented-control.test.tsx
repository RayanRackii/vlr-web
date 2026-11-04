import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"

import { SegmentedControl } from "./segmented-control"

function Controlled() {
  const [value, setValue] = useState("active")
  return (
    <SegmentedControl
      label="Status"
      value={value}
      onChange={setValue}
      options={[
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "draft", label: "Draft" },
      ]}
    />
  )
}

it("exposes a radiogroup with one radio per option", () => {
  render(<Controlled />)
  expect(screen.getByRole("radiogroup", { name: "Status" })).toBeInTheDocument()
  expect(screen.getAllByRole("radio")).toHaveLength(3)
})

it("moves focus and selection with arrow keys, wraps, and keeps one tab stop", async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  const radios = screen.getAllByRole("radio")
  await user.tab()
  expect(radios[0]).toHaveFocus()
  for (const [key, index] of [
    ["{ArrowRight}", 1], ["{ArrowDown}", 2], ["{ArrowRight}", 0],
    ["{ArrowLeft}", 2], ["{Home}", 0], ["{End}", 2],
  ] as const) {
    await user.keyboard(key)
    expect(radios[index]).toHaveFocus()
    radios.forEach((radio, position) => {
      expect(radio).toHaveAttribute("aria-checked", String(position === index))
      expect(radio).toHaveAttribute("tabindex", position === index ? "0" : "-1")
    })
  }
})

it("selects on click", async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  await user.click(screen.getByRole("radio", { name: "Draft" }))
  expect(screen.getByRole("radio", { name: "Draft" })).toHaveAttribute("aria-checked", "true")
})
