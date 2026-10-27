import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Breadcrumb } from "./Breadcrumb"
import { ModuleIntroPage } from "./ModuleIntroPage"
import { Sidebar } from "./Sidebar"
import { moduleIntroContent } from "./navigationIntros"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({ isPlatformAdmin: false, isInTenantEnvironment: true }),
}))

const allPermissions = [
  "core.dashboard.read", "core.units.read", "core.users.read", "core.registration_fields.read",
  "rentals.assets.read", "rentals.layouts.read", "rentals.schedule.read",
  "rentals.reservations.read", "rentals.booking_policy.read",
  "inventory.assets.read", "inventory.categories.read",
  "pmoc.plans.read", "pmoc.plans.write", "pmoc.templates.read", "os.work_orders.read",
  "catalog.products.read",
]
const allModules = ["rentals", "inventory", "pmoc", "os", "catalog"]

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderIntro(path: string, {
  permissions = allPermissions,
  modules = allModules,
  sidebar = false,
  collapsed = false,
  loading = false,
} = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={permissions} activeModules={modules} isLoading={loading}>
        <Location />
        {sidebar && <Sidebar collapsed={collapsed} touchTargets />}
        <Breadcrumb />
        <Routes>
          <Route path="/modulos/:moduleKey" element={<ModuleIntroPage />} />
          <Route path="*" element={null} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

afterEach(async () => { await i18n.changeLanguage("pt-BR") })

describe("module introductions", () => {
  it.each([
    ["bookings", "Reservas", "Recursos", "/configuracoes/recursos"],
    ["maintenance", "Manutenção", "Tipos de equipamento", "/ativos/categorias"],
    ["pmoc", "Planos de manutenção", "Biblioteca Rolvix", "/pmoc/biblioteca"],
  ])("renders %s from navigation metadata", (key, title, shortcut, href) => {
    renderIntro(`/modulos/${key}`)
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument()
    const content = moduleIntroContent[key as keyof typeof moduleIntroContent]
    expect(screen.getByText(i18n.t(content.summaryKey))).toBeInTheDocument()
    const how = screen.getByRole("region", { name: "Como funciona" })
    expect(within(how).getAllByRole("listitem")).toHaveLength(content.howItWorksKeys.length)
    expect(within(screen.getByRole("region", { name: "Atalhos" })).getByRole("link", { name: shortcut })).toHaveAttribute("href", href)
    const breadcrumb = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(breadcrumb).getByText(title)).toBeInTheDocument()
    expect(within(breadcrumb).getByText("Apresentação")).toHaveAttribute("aria-current", "page")
  })

  it("uses the permitted tab as a shortcut without leaking its hidden sibling", () => {
    renderIntro("/modulos/bookings", { permissions: ["rentals.booking_policy.read"] })
    const shortcuts = screen.getByRole("region", { name: "Atalhos" })
    expect(within(shortcuts).getByRole("link", { name: "Regras de reserva" })).toHaveAttribute("href", "/configuracoes/politica-reservas")
    expect(within(shortcuts).queryByRole("link", { name: "Reservas" })).not.toBeInTheDocument()
    expect(within(shortcuts).queryByRole("link", { name: "Recursos" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Módulos relacionados" })).not.toBeInTheDocument()
  })

  it("filters nested shortcuts and related modules by enabled modules and permissions", () => {
    renderIntro("/modulos/maintenance", { permissions: allPermissions, modules: ["inventory"] })
    const shortcuts = screen.getByRole("region", { name: "Atalhos" })
    expect(within(shortcuts).getByRole("link", { name: "Equipamentos" })).toHaveAttribute("href", "/ativos")
    expect(within(shortcuts).getByRole("link", { name: "Tipos de equipamento" })).toBeInTheDocument()
    expect(within(shortcuts).queryByRole("link", { name: "Meus planos" })).not.toBeInTheDocument()
    expect(within(shortcuts).queryByRole("link", { name: "Ordens de serviço" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Reservas" })).not.toBeInTheDocument()
  })

  it.each(["unknown", "constructor", "toString"])("uses the existing not-found UI for %s", (key) => {
    renderIntro(`/modulos/${key}`)
    expect(screen.getByRole("heading", { name: i18n.t("notFound.title") })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Atalhos" })).not.toBeInTheDocument()
  })

  it.each([
    { permissions: [], modules: allModules },
    { permissions: allPermissions, modules: [] },
  ])("does not expose an unavailable module intro ($permissions, $modules)", (access) => {
    renderIntro("/modulos/bookings", access)
    expect(screen.getByRole("heading", { name: i18n.t("notFound.title") })).toBeInTheDocument()
  })

  it("waits for navigation permissions before resolving the intro", () => {
    renderIntro("/modulos/bookings", { loading: true })
    expect(screen.getByRole("status", { busy: true })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: i18n.t("notFound.title") })).not.toBeInTheDocument()
  })

  it("links to visible related intros", () => {
    renderIntro("/modulos/bookings")
    const related = screen.getByRole("region", { name: "Módulos relacionados" })
    expect(within(related).getByRole("link", { name: "Manutenção" })).toHaveAttribute("href", "/modulos/maintenance")
  })

  it("navigates from a section title independently of its toggle", async () => {
    const user = userEvent.setup()
    renderIntro("/configuracoes/recursos", { sidebar: true })
    const nav = screen.getByRole("navigation", { name: "Menu de navegação" })
    const toggle = within(nav).getByRole("button", { name: "Recolher Reservas" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    await user.click(toggle)
    expect(screen.getByTestId("location")).toHaveTextContent("/configuracoes/recursos")
    expect(within(nav).queryByRole("link", { name: "Recursos" })).not.toBeInTheDocument()
    await user.click(within(nav).getByRole("link", { name: "Sobre Reservas" }))
    expect(screen.getByRole("heading", { level: 1, name: "Reservas" })).toBeInTheDocument()
    expect(within(nav).getByRole("link", { name: "Sobre Reservas" })).toHaveAttribute("aria-current", "page")
    await user.click(within(nav).getByRole("button", { name: "Expandir Reservas" }))
    expect(within(nav).getByRole("link", { name: "Recursos" })).toBeVisible()
  })

  it("navigates from a nested module title while its own toggle still expands", async () => {
    const user = userEvent.setup()
    renderIntro("/pmoc", { sidebar: true })
    const nav = screen.getByRole("navigation", { name: "Menu de navegação" })
    await user.click(within(nav).getByRole("button", { name: "Recolher Planos de manutenção" }))
    expect(within(nav).queryByRole("link", { name: "Meus planos" })).not.toBeInTheDocument()
    await user.click(within(nav).getByRole("link", { name: "Sobre Planos de manutenção" }))
    expect(screen.getByTestId("location")).toHaveTextContent("/modulos/pmoc")
    expect(within(nav).getByRole("link", { name: "Sobre Planos de manutenção" })).toHaveAttribute("aria-current", "page")
    await user.click(within(nav).getByRole("button", { name: "Expandir Planos de manutenção" }))
    expect(within(nav).getByRole("link", { name: "Meus planos" })).toBeVisible()
  })

  it("keeps section intros reachable in the collapsed rail", async () => {
    renderIntro("/pmoc", { sidebar: true, collapsed: true })
    const nav = screen.getByRole("navigation", { name: "Menu de navegação" })
    await userEvent.click(within(nav).getByRole("link", { name: "Sobre Reservas" }))
    expect(screen.getByRole("heading", { level: 1, name: "Reservas" })).toBeInTheDocument()
  })

  it.each(["pt-BR", "en", "es"])("has complete intro and control translations in %s", async (locale) => {
    await i18n.changeLanguage(locale)
    const keys = [
      "moduleIntro.title", "moduleIntro.howItWorks", "moduleIntro.relatedModules", "moduleIntro.shortcuts",
      "moduleIntro.open", "moduleIntro.expand", "moduleIntro.collapse",
      ...Object.values(moduleIntroContent).flatMap((content) => [content.summaryKey, ...content.howItWorksKeys]),
    ]
    for (const key of keys) {
      const value: unknown = i18n.getResource(locale, "common", key)
      expect(value, `${locale}: ${key}`).toBeTypeOf("string")
      expect(value).not.toBe("")
      expect(value).not.toMatch(/\b(quadra|court|sport|deport|cancha)\w*\b/i)
    }
    renderIntro("/modulos/bookings", { sidebar: true })
    expect(screen.getByRole("heading", { level: 1, name: i18n.t("nav.sections.bookings") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("moduleIntro.collapse", { module: i18n.t("nav.sections.bookings") }) })).toBeInTheDocument()
  })
})
