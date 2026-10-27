import { act, render, screen, within } from "@testing-library/react"
import { Link, MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Breadcrumb } from "./Breadcrumb"
import { BreadcrumbTitleProvider } from "./BreadcrumbTitleProvider"
import { useBreadcrumbTitle } from "./useBreadcrumbTitle"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => ({
  usePlatformTenantSession: () => ({ isPlatformAdmin: false, isInTenantEnvironment: false }),
}))

const permissions = [
  "pmoc.plans.read", "pmoc.plans.write", "pmoc.templates.read", "os.work_orders.read",
  "inventory.assets.read", "inventory.categories.read", "core.users.read",
  "core.registration_fields.read", "rentals.reservations.read", "rentals.booking_policy.read",
]

function Detail({ title }: { title?: string }) {
  useBreadcrumbTitle(title)
  return <Link to="/os/another">Another detail</Link>
}

function renderBreadcrumb(path: string, title?: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={permissions} activeModules={["pmoc", "os", "inventory", "rentals"]}>
        <BreadcrumbTitleProvider>
          <Breadcrumb />
          <Routes>
            <Route path="/pmoc/:id" element={<Detail title={title} />} />
            <Route path="*" element={null} />
          </Routes>
        </BreadcrumbTitleProvider>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage("pt-BR")
})

describe("staff breadcrumb", () => {
  it("renders the list label as the current page", () => {
    renderBreadcrumb("/os")
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(nav).getByText("Ordens de serviço")).toHaveAttribute("aria-current", "page")
    expect(within(nav).queryByRole("link")).not.toBeInTheDocument()
  })

  it.each([undefined, "Plano de climatização"])("renders a detail with title %s", (title) => {
    renderBreadcrumb("/pmoc/plan-1", title)
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(nav).getByRole("link", { name: "Meus planos" })).toHaveAttribute("href", "/pmoc")
    expect(within(nav).getByText(title ?? "Detalhes")).toHaveAttribute("aria-current", "page")
  })

  it.each([
    ["/ativos/categorias", "Equipamentos", "Tipos de equipamento", "/ativos"],
    ["/configuracoes/politica-reservas", "Reservas", "Regras de reserva", "/configuracoes/reservas"],
    ["/configuracoes/cadastro", "Pessoas e acesso", "Formulário de cadastro", "/pessoas-e-acesso"],
    ["/pmoc/biblioteca", "Novo plano", "Biblioteca Rolvix", "/pmoc/novo"],
  ])("renders parent and tab for %s", (path, parent, tab, href) => {
    renderBreadcrumb(path)
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(nav).getByRole("link", { name: parent })).toHaveAttribute("href", href)
    expect(within(nav).getByText(tab)).toHaveAttribute("aria-current", "page")
  })

  it.each([
    ["pt-BR", "Caminho de navegação", "Equipamentos", "Tipos de equipamento", "Detalhes"],
    ["en", "Breadcrumb", "Equipment", "Equipment types", "Details"],
    ["es", "Ruta de navegación", "Equipos", "Tipos de equipo", "Detalles"],
  ])("translates navigation, tabs and fallback in %s", async (locale, label, parent, tab, details) => {
    await i18n.changeLanguage(locale)
    const view = renderBreadcrumb("/ativos/categorias")
    const nav = screen.getByRole("navigation", { name: label })
    expect(within(nav).getByRole("link", { name: parent })).toBeInTheDocument()
    expect(within(nav).getByText(tab)).toHaveAttribute("aria-current", "page")
    view.unmount()
    renderBreadcrumb("/pmoc/plan-1")
    expect(within(screen.getByRole("navigation", { name: label })).getByText(details)).toHaveAttribute("aria-current", "page")
  })

  it("collapses to a parent back-link and current page on narrow screens", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    renderBreadcrumb("/pmoc/plan-1", "Plano A")
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2)
    expect(within(nav).getByRole("link", { name: "Voltar para Meus planos" })).toHaveAttribute("href", "/pmoc")
    expect(within(nav).getByText("Plano A")).toHaveAttribute("aria-current", "page")
    expect(within(nav).queryByText("Planos de manutenção")).not.toBeInTheDocument()
  })

  it("clears the entity title when leaving the detail page", async () => {
    renderBreadcrumb("/pmoc/plan-1", "Plano A")
    await act(async () => screen.getByRole("link", { name: "Another detail" }).click())
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(nav).queryByText("Plano A")).not.toBeInTheDocument()
    expect(within(nav).getByText("Detalhes")).toHaveAttribute("aria-current", "page")
  })

  it("updates the collapsed trail when the viewport changes", () => {
    let onChange = () => undefined
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: string, listener: () => undefined) => { onChange = listener }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal("matchMedia", vi.fn(() => media))
    const view = renderBreadcrumb("/pmoc/plan-1", "Plano A")
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    expect(within(nav).getAllByRole("listitem")).toHaveLength(3)
    act(() => {
      media.matches = true
      onChange()
    })
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2)
    view.unmount()
    expect(media.removeEventListener).toHaveBeenCalledWith("change", onChange)
  })

  it("uses the shared title metadata for staff pages outside the sidebar", () => {
    renderBreadcrumb("/perfil")
    expect(screen.getByText(i18n.t("account.profile"))).toHaveAttribute("aria-current", "page")
  })
})
