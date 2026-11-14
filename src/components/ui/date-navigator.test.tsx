import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DateNavigator } from "@/components/ui/date-navigator"

const views = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
] as const

function setup() {
  const onDateChange = vi.fn()
  const onViewChange = vi.fn()
  const step = vi.fn((date: string, _view: string, direction: -1 | 1) => `${date}|${direction}`)
  render(
    <DateNavigator
      date="2026-11-14"
      onDateChange={onDateChange}
      view="day"
      views={views}
      onViewChange={onViewChange}
      step={step}
      today="2026-11-10"
      label="sábado, 14 de novembro"
      labels={{ previous: "Anterior", next: "Próximo", today: "Hoje", view: "Período" }}
    />,
  )
  return { onDateChange, onViewChange, step }
}

describe("DateNavigator", () => {
  it("orders view, previous, label, next, today", () => {
    setup()
    const nodes = [
      screen.getByRole("radiogroup", { name: "Período" }),
      screen.getByRole("button", { name: "Anterior" }),
      screen.getByText("sábado, 14 de novembro"),
      screen.getByRole("button", { name: "Próximo" }),
      screen.getByRole("button", { name: "Hoje" }),
    ]
    nodes.slice(1).forEach((node, index) => {
      expect(nodes[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it("steps with -1 and +1 and jumps to today", async () => {
    const user = userEvent.setup()
    const { onDateChange, step } = setup()
    await user.click(screen.getByRole("button", { name: "Anterior" }))
    expect(step).toHaveBeenLastCalledWith("2026-11-14", "day", -1)
    expect(onDateChange).toHaveBeenLastCalledWith("2026-11-14|-1")
    await user.click(screen.getByRole("button", { name: "Próximo" }))
    expect(step).toHaveBeenLastCalledWith("2026-11-14", "day", 1)
    await user.click(screen.getByRole("button", { name: "Hoje" }))
    expect(onDateChange).toHaveBeenLastCalledWith("2026-11-10")
  })

  it("changes the view and announces the label politely", async () => {
    const user = userEvent.setup()
    const { onViewChange } = setup()
    await user.click(screen.getByRole("radio", { name: "Semana" }))
    expect(onViewChange).toHaveBeenCalledWith("week")
    expect(screen.getByText("sábado, 14 de novembro")).toHaveAttribute("aria-live", "polite")
  })
})
