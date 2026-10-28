import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { Sidebar } from "@/components/layout/Sidebar"
import { RENTAL_RESOURCES_PERMISSIONS } from "@/components/layout/navigation"
import i18n from "@/lib/i18n"
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

function renderSidebar(permissions: readonly string[], modules = ["rentals"], path = "/", props: { collapsed?: boolean; touchTargets?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={permissions} activeModules={modules}>
        <Sidebar {...props} />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("Sidebar access by role permissions", () => {
  it.each([
    { collapsed: false },
    { collapsed: true },
    { touchTargets: true },
  ])("separates consecutive navigation groups in mode %j", (props) => {
    renderSidebar(["core.dashboard.read", "rentals.reservations.read", "core.users.read"], ["rentals"], "/", props)
    const nav = screen.getByRole("navigation")
    const groups = Array.from(nav.children).filter((child) => !child.matches('[data-slot="separator"]'))
    const separators = nav.querySelectorAll('[data-slot="separator"]')
    expect(groups.length).toBeGreaterThan(1)
    expect(separators).toHaveLength(groups.length - 1)
    expect(nav.firstElementChild).toBe(groups[0])
    separators.forEach((separator) => expect(separator).toHaveClass("bg-[var(--sidebar-border)]"))
  })

  it("does not show Recursos to a professor", () => {
    renderSidebar(professorPermissions)

    expect(screen.queryByRole("link", { name: "Recursos" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Horários" })).toBeInTheDocument()
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
  })

  it("shows Recursos to a resource manager and hides the agenda", () => {
    renderSidebar(RENTAL_RESOURCES_PERMISSIONS)

    expect(screen.getByRole("link", { name: "Recursos" })).toHaveAttribute(
      "href",
      "/configuracoes/recursos",
    )
    expect(screen.queryByRole("link", { name: "Horários" })).not.toBeInTheDocument()
  })

  it("shows Recursos and the agenda to a club admin", () => {
    renderSidebar([
      "core.dashboard.read",
      "core.units.read",
      "rentals.assets.read",
      "rentals.schedule.read",
    ])

    expect(screen.getByRole("link", { name: "Recursos" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Horários" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Início" })).toBeInTheDocument()
  })

  it("shows only reservations to a receptionist", () => {
    renderSidebar(["rentals.reservations.read"])

    expect(screen.getByRole("link", { name: "Reservas" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Recursos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Horários" })).not.toBeInTheDocument()
  })
})

it.each([
  ["/pmoc/plan-1", "Meus planos"],
  ["/pmoc/plan-1/tasks", "Meus planos"],
  ["/pmoc/novo", "Novo plano"],
  ["/pmoc/biblioteca/template-1", "Novo plano"],
  ["/ativos/categorias", "Equipamentos"],
  ["/configuracoes/politica-reservas", "Reservas"],
  ["/configuracoes/cadastro", "Pessoas e acesso"],
])("keeps only the owning sidebar entry active at %s", (path, label) => {
  renderSidebar([
    "pmoc.plans.read", "pmoc.plans.write", "pmoc.templates.read",
    "inventory.assets.read", "inventory.categories.read", "rentals.reservations.read",
    "rentals.booking_policy.read", "core.users.read", "core.registration_fields.read",
  ], ["pmoc", "inventory", "rentals"], path)
  const active = screen.getByRole("link", { name: label, current: "page" })
  expect(active).toHaveClass("text-primary")
  expect(screen.getAllByRole("link", { current: "page" })).toEqual([active])
  if (path.startsWith("/pmoc/")) {
    expect(screen.getByRole("link", { name: "Meus planos" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Novo plano" })).toBeVisible()
    expect(screen.getByText("Planos de manutenção").parentElement).toHaveClass("text-foreground")
  }
})

it("does not activate a sidebar entry for a partial segment", () => {
  renderSidebar(["inventory.assets.read"], ["inventory"], "/ativosX")
  expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument()
})


it.each([
  ["pt-BR", "Início", "Reservas", "Manutenção", "Vendas", "Pessoas e portal", "Equipamentos", "Planos de manutenção"],
  ["en", "Home", "Bookings", "Maintenance", "Sales", "People & portal", "Equipment", "Maintenance plans"],
  ["es", "Inicio", "Reservas", "Mantenimiento", "Ventas", "Personas y portal", "Equipos", "Planes de mantenimiento"],
])("renders the approved staff names in %s and keeps secondary screens out of the sidebar", async (locale, home, bookings, maintenance, sales, people, equipment, plans) => {
  await i18n.changeLanguage(locale)
  try {
    renderSidebar([
      "core.dashboard.read", "rentals.reservations.read", "rentals.booking_policy.read",
      "inventory.assets.read", "inventory.categories.read", "pmoc.plans.read", "pmoc.plans.write",
      "pmoc.templates.read", "catalog.products.read", "core.users.read", "core.registration_fields.read",
    ], ["rentals", "inventory", "catalog", "pmoc"])
    expect(screen.getByRole("link", { name: home })).toBeInTheDocument()
    for (const group of [bookings, maintenance, sales, people]) expect(screen.getAllByText(group, { exact: true }).length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: equipment })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: bookings })).toBeInTheDocument()
    expect(screen.getByText(plans, { exact: true }).parentElement).toHaveAttribute("title", locale === "pt-BR" ? "PMOC" : plans)
    for (const key of ["nav.assetsCategories", "nav.bookingPolicy", "nav.pmocLibrary", "nav.registrationFields"]) {
      expect(screen.queryByRole("link", { name: i18n.t(key) })).not.toBeInTheDocument()
    }
    expect(screen.queryByTitle("PMOC") !== null).toBe(locale === "pt-BR")
  } finally {
    await i18n.changeLanguage("pt-BR")
  }
})
