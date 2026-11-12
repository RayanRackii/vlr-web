import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  it("does not show Recursos to a professor", async () => {
    renderSidebar(professorPermissions)
    await userEvent.click(screen.getByRole("button", { name: "Expandir Configurações" }))

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

  it("hides the agenda when the reader cannot list rental assets", () => {
    renderSidebar(["rentals.schedule.read"])

    expect(screen.queryByRole("link", { name: "Horários" })).not.toBeInTheDocument()
  })

  it("shows Recursos and the agenda to a club admin", async () => {
    renderSidebar([
      "core.dashboard.read",
      "core.units.read",
      "rentals.assets.read",
      "rentals.schedule.read",
    ])

    await userEvent.click(screen.getByRole("button", { name: "Expandir Configurações" }))
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
  ["/manutencao", "Manutenção"],
  ["/manutencao/planos/novo", "Manutenção"],
  ["/manutencao/ordens/nova", "Manutenção"],
  ["/ativos/tipos", "Equipamentos"],
  ["/configuracoes/politica-reservas", "Reservas"],
  ["/configuracoes/cadastro", "Pessoas"],
])("keeps only the owning sidebar entry active at %s", (path, label) => {
  renderSidebar([
    "pmoc.plans.read", "pmoc.plans.write", "pmoc.templates.read",
    "inventory.assets.read", "inventory.categories.read", "rentals.reservations.read",
    "rentals.booking_policy.read", "core.users.read", "core.registration_fields.read",
  ], ["pmoc", "inventory", "rentals"], path)
  const active = screen.getByRole("link", { name: label, current: "page" })
  expect(active).toHaveClass("text-primary")
  expect(screen.getAllByRole("link", { current: "page" })).toEqual([active])

})

it("does not activate a sidebar entry for a partial segment", () => {
  renderSidebar(["inventory.assets.read"], ["inventory"], "/ativosX")
  expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument()
})


it.each([
  ["pt-BR", "Início", "Operação", "Cadastro", "Clientes", "Configurações"],
  ["en", "Home", "Operations", "Registration", "Customers", "Settings"],
  ["es", "Inicio", "Operación", "Registro", "Clientes", "Configuración"],
])("renders the approved groups in %s", async (locale, home, operations, registration, customers, settings) => {
  await i18n.changeLanguage(locale)
  try {
    renderSidebar(["core.dashboard.read", "rentals.reservations.read", "inventory.assets.read", "core.users.read", "rentals.schedule.read", "rentals.assets.read", "core.module_menu.read"], ["rentals", "inventory"])
    expect(screen.getByRole("link", { name: home })).toHaveAttribute("href", "/dashboard")
    for (const group of [operations, registration, customers, "Portal", settings]) {
      expect(screen.getByText(group, { exact: true })).toBeInTheDocument()
    }
    expect(screen.queryByRole("button", { name: i18n.t("moduleIntro.collapse", { module: home }) })).not.toBeInTheDocument()
  } finally { await i18n.changeLanguage("pt-BR") }
})

it("starts settings collapsed and toggles groups only through dedicated plus/minus controls", async () => {
  renderSidebar(["rentals.schedule.read", "rentals.assets.read", "rentals.reservations.read"])
  const user = userEvent.setup()
  const settings = screen.getByRole("button", { name: "Expandir Configurações" })
  expect(settings).toHaveAttribute("aria-expanded", "false")
  expect(settings.querySelector(".lucide-plus")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Horários" })).not.toBeInTheDocument()
  await user.click(settings)
  expect(settings).toHaveAttribute("aria-expanded", "true")
  expect(settings.querySelector(".lucide-minus")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Horários" })).toBeVisible()
  const operations = screen.getByRole("button", { name: "Recolher Operação" })
  await user.click(operations)
  expect(screen.queryByRole("link", { name: "Reservas" })).not.toBeInTheDocument()
  await user.click(operations)
  expect(screen.getByRole("link", { name: "Reservas" })).toBeVisible()
})


it.each([
  ["/agendas", "Visão geral"], ["/agendas/recursos", "Agenda de recursos"], ["/agendas/produto", "Agenda do produto"],
])("marks exactly the new agenda child current at %s", (path, label) => {
  renderSidebar(["rentals.schedule.read", "catalog.orders.read"], ["rentals", "catalog"], path)
  expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1)
  expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page")
  const toggle = screen.getByRole("button", { name: "Recolher Agendas" })
  expect(toggle.querySelector(".lucide-minus")).toBeInTheDocument()
  const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"))
  for (const legacy of ["/agenda", "/catalogo/agenda-recursos", "/catalogo/agenda-produto"]) expect(links).not.toContain(legacy)
})

it.each(["/pmoc", "/pmoc/novo", "/pmoc/biblioteca", "/pmoc/plan-1", "/os", "/os/nova"])("keeps old %s out of the product menu", path => {
  renderSidebar(["pmoc.plans.read", "pmoc.plans.write", "pmoc.templates.read", "os.work_orders.read"], ["pmoc", "os"], path)
  expect(screen.getByRole("link", { name: "Manutenção" })).toHaveAttribute("href", "/manutencao")
  expect(screen.queryByRole("link", { name: "Meus planos" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Novo plano" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Ordens de serviço" })).not.toBeInTheDocument()
})
