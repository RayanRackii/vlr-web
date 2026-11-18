import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { Lock, Power, Settings, Trash2 } from "lucide-react"
import { describe, expect, it, vi } from "vitest"

import { RowActionsMenu, type RowActionItem } from "@/components/data-table/RowActionsMenu"

function renderMenu(items: RowActionItem[]) {
  return render(
    <MemoryRouter>
      <RowActionsMenu label="Ações de Raquete" items={items} />
    </MemoryRouter>,
  )
}

describe("RowActionsMenu", () => {
  it("renders nothing without items", () => {
    const { container } = renderMenu([])
    expect(container).toBeEmptyDOMElement()
  })

  it("renders items with icons, a separator, links and the hint; the primary tone gets its class", async () => {
    const user = userEvent.setup()
    renderMenu([
      { key: "a", label: "Concluir", icon: Settings, href: "/x", tone: "primary" },
      { key: "b", label: "Acesso", icon: Lock, onSelect: vi.fn() },
      { key: "c", label: "Ativar", icon: Power, disabled: true, hint: "Conclua o cadastro", separatorBefore: true },
    ])
    await user.click(screen.getByRole("button", { name: "Ações de Raquete" }))
    const primary = await screen.findByRole("menuitem", { name: "Concluir" })
    expect(primary).toHaveAttribute("href", "/x")
    expect(primary.className).toContain("bg-primary/10")
    expect(primary.querySelector("svg")).not.toBeNull()
    expect(primary.className).toContain("focus:bg-primary/20")
    expect(primary.className).toContain("focus:**:!text-primary")
    expect(screen.getByText("Conclua o cadastro").className).toContain("!text-muted-foreground")
    expect(screen.getByRole("separator")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: /Ativar/ })).toHaveTextContent("Conclua o cadastro")
  })

  it("fires onSelect, but not for a disabled item; danger uses destructive text", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onDisabled = vi.fn()
    renderMenu([
      { key: "d", label: "Excluir", icon: Trash2, tone: "danger", onSelect },
      { key: "e", label: "Bloqueado", icon: Power, disabled: true, onSelect: onDisabled },
    ])
    await user.click(screen.getByRole("button", { name: "Ações de Raquete" }))
    await user.click(await screen.findByRole("menuitem", { name: "Bloqueado" }))
    expect(onDisabled).not.toHaveBeenCalled()
    const danger = screen.getByRole("menuitem", { name: "Excluir" })
    expect(danger.className).toContain("text-destructive")
    expect(danger.className).toContain("focus:**:!text-destructive")
    await user.click(danger)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it("ignores separatorBefore on the first item", async () => {
    const user = userEvent.setup()
    renderMenu([{ key: "d", label: "Excluir", icon: Trash2, tone: "danger", separatorBefore: true }])
    await user.click(screen.getByRole("button", { name: "Ações de Raquete" }))
    await screen.findByRole("menuitem", { name: "Excluir" })
    expect(screen.queryByRole("separator")).not.toBeInTheDocument()
  })
})
