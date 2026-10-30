import { fireEvent, render, screen } from "@testing-library/react"
import { CalendarDays } from "lucide-react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

describe("EmptyState", () => {
  it("offers the primary action, a short example and a module link", () => {
    const create = vi.fn()
    render(<MemoryRouter><EmptyState
      icon={CalendarDays}
      title="Nenhuma reserva"
      description="Comece reservando um horário."
      example="Ex.: uma sala às 14h, por 1 hora"
      learnMore={{ to: "/modulos/bookings", label: "Saiba mais" }}
      action={<Button onClick={create}>Reservar horário</Button>}
    /></MemoryRouter>)

    expect(screen.getByText("Ex.: uma sala às 14h, por 1 hora")).toBeVisible()
    expect(screen.getByRole("link", { name: "Saiba mais" })).toHaveAttribute("href", "/modulos/bookings")
    fireEvent.click(screen.getByRole("button", { name: "Reservar horário" }))
    expect(create).toHaveBeenCalledOnce()
  })

  it("preserves portal status and styling and disables entry for reduced motion", () => {
    const { container } = render(<EmptyState variant="portal" icon={CalendarDays} title="Sem reservas" />)
    expect(screen.getByRole("status")).toHaveClass("portal-empty", "motion-reduce:animate-none")
    expect(container.querySelector(".portal-empty-icon svg")).toHaveAttribute("stroke-width", "1.75")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("uses the illustration slot in place of an icon", () => {
    const { container } = render(<EmptyState icon={CalendarDays} title="Sem itens" illustration={<span>Ilustração</span>} />)
    expect(screen.getByText("Ilustração")).toBeVisible()
    expect(container.querySelector("svg")).toBeNull()
  })
})
