import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it } from "vitest"
import { SegmentedControl } from "./SegmentedControl"

function ControlledSegments() {
  const [value, setValue] = useState("all")
  return <SegmentedControl label="Period" value={value} onChange={setValue} options={[
    { value: "all", label: "All" },
    { value: "morning", label: "Morning" },
    { value: "night", label: "Night" },
  ]} />
}

it("moves focus and selection with arrow keys, wraps, and keeps one tab stop", async () => {
  const user = userEvent.setup()
  render(<ControlledSegments />)
  const radios = screen.getAllByRole("radio")
  await user.tab()
  expect(radios[0]).toHaveFocus()
  for (const [key, index] of [
    ["{ArrowRight}", 1], ["{ArrowDown}", 2], ["{ArrowRight}", 0],
    ["{ArrowLeft}", 2], ["{ArrowUp}", 1], ["{Home}", 0], ["{End}", 2],
  ] as const) {
    await user.keyboard(key)
    expect(radios[index]).toHaveFocus()
    radios.forEach((radio, position) => {
      expect(radio).toHaveAttribute("aria-checked", String(position === index))
      expect(radio).toHaveAttribute("tabindex", position === index ? "0" : "-1")
    })
  }
})
