import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { FilterTabs } from "./FilterTabs"

const options = [{ value: "a", label: "Alpha", count: 2 }, { value: "b", label: "Beta", count: 0 }] as const

describe("FilterTabs", () => {
  it("renders all first with counts and marks the selection", () => {
    render(<FilterTabs label="Tipo" allLabel="Todos" value="a" onChange={() => {}} options={options} allCount={2} />)
    const buttons = within(screen.getByRole("group", { name: "Tipo" })).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual(["Todos2", "Alpha2", "Beta0"])
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true")
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false")
  })

  it("selects an option and returns to all with null", async () => {
    const onChange = vi.fn()
    render(<FilterTabs label="Tipo" allLabel="Todos" value="a" onChange={onChange} options={options} />)
    await userEvent.click(screen.getByRole("button", { name: /Beta/ }))
    expect(onChange).toHaveBeenLastCalledWith("b")
    await userEvent.click(screen.getByRole("button", { name: /Todos/ }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})
