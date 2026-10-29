import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { PeopleBottomNavigation } from "./PeopleBottomNavigation"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

function renderNav(permissions: string[], activeModules: string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={activeModules}>
        <PeopleBottomNavigation />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("PeopleBottomNavigation", () => {
  it("shows every destination the user has permission and modules for", () => {
    renderNav(
      ["core.dashboard.read", "rentals.reservations.read", "os.work_orders.read", "core.users.read"],
      ["rentals", "os"],
    )

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("href", "/dashboard")
    expect(screen.getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/configuracoes/reservas")
    expect(screen.getByRole("link", { name: "Ordens de serviço" })).toHaveAttribute("href", "/os")
    expect(screen.getByRole("link", { name: "Pessoas e acesso" })).toHaveAttribute("href", "/pessoas-e-acesso")
    expect(screen.getByRole("link", { name: "Meu Perfil" })).toHaveAttribute("href", "/perfil")
  })

  it("hides destinations the user lacks permission for and always keeps profile", () => {
    renderNav(["core.users.read"], [])

    expect(screen.getByRole("link", { name: "Pessoas e acesso" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Meu Perfil" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Início" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Reservas" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Ordens de serviço" })).not.toBeInTheDocument()
  })

  it("hides a module-gated destination when the module is inactive even with permission", () => {
    renderNav(["rentals.reservations.read", "os.work_orders.read", "core.users.read"], [])

    expect(screen.queryByRole("link", { name: "Reservas" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Ordens de serviço" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Pessoas e acesso" })).toBeInTheDocument()
  })
})
