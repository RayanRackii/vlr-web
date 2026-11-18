import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { StatusChips } from "@/components/data-table/StatusChips"

const options = [
  { value: "a", label: "Alfa", tone: "warning", count: 2 },
  { value: "b", label: "Beta", tone: "success", count: 5 },
] as const

function setup(value: "a" | "b" | null = null) {
  const onChange = vi.fn()
  render(<StatusChips label="Status" allLabel="Todos" value={value} onChange={onChange} options={options} allCount={7} />)
  return { onChange, group: screen.getByRole("group", { name: "Status" }) }
}

describe("StatusChips", () => {
  it("puts Todos first and pressed when value is null", () => {
    const { group } = setup(null)
    const buttons = within(group).getAllByRole("button")
    expect(buttons[0]).toHaveTextContent("Todos")
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true")
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false")
  })

  it("shows counts and tone dots", () => {
    const { group } = setup()
    const [all, alfa] = within(group).getAllByRole("button")
    expect(all).toHaveTextContent("7")
    expect(alfa).toHaveTextContent("2")
    expect(alfa.querySelector("[data-status-tone='warning']")).not.toBeNull()
    expect(all.querySelector("[data-status-tone]")).toBeNull()
  })

  it("selects an option and clears through Todos", async () => {
    const user = userEvent.setup()
    const { onChange, group } = setup("a")
    await user.click(within(group).getByRole("button", { name: /Beta/ }))
    expect(onChange).toHaveBeenCalledWith("b")
    await user.click(within(group).getByRole("button", { name: /Todos/ }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
