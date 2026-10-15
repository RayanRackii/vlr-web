import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { Sidebar } from "@/components/layout/Sidebar"
import { RENTAL_RESOURCES_PERMISSIONS } from "@/components/layout/navigation"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({
    isPlatformAdmin: false,
    isInTenantEnvironment: false,
    activeTenantId: null,
    activeTenantLabel: null,
    clearTenantLabel: () => undefined,
  }),
}))

const professorPermissions = [
  "rentals.assets.read",
  "rentals.occupancy_kinds.read",
  "rentals.schedule.read",
  "rentals.schedule.lessons.write",
]

function renderSidebar(permissions: readonly string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
        <Sidebar />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("Sidebar access by role permissions", () => {
  it("does not show Recursos to a professor", () => {
    renderSidebar(professorPermissions)

    expect(screen.queryByRole("link", { name: "Recursos" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Escala / agenda" })).toBeInTheDocument()
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
  })

  it("shows Recursos to a resource manager and hides the agenda", () => {
    renderSidebar(RENTAL_RESOURCES_PERMISSIONS)

    expect(screen.getByRole("link", { name: "Recursos" })).toHaveAttribute(
      "href",
      "/configuracoes/recursos",
    )
    expect(screen.queryByRole("link", { name: "Escala / agenda" })).not.toBeInTheDocument()
  })

  it("shows Recursos and the agenda to a club admin", () => {
    renderSidebar([
      "core.dashboard.read",
      "core.units.read",
      "rentals.assets.read",
      "rentals.schedule.read",
    ])

    expect(screen.getByRole("link", { name: "Recursos" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Escala / agenda" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument()
  })

  it("shows only reservations to a receptionist", () => {
    renderSidebar(["rentals.reservations.read"])

    expect(screen.getByRole("link", { name: "Reservas" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Recursos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Escala / agenda" })).not.toBeInTheDocument()
  })
})
