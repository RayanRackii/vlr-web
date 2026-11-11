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
            <Route path="/pedidos/:orderId" element={<Detail title={title} />} />
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
  it("does not repeat a page title that has no parent", () => {
    renderBreadcrumb("/os")
    expect(screen.queryByRole("navigation", { name: "Caminho de navegação" })).not.toBeInTheDocument()
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

  it("does not repeat the profile title when it is the only crumb", () => {
    renderBreadcrumb("/perfil")
    expect(screen.queryByRole("navigation", { name: "Caminho de navegação" })).not.toBeInTheDocument()
  })

  it.each([
    ["/catalogo/grupos/novo", "Grupos", "/catalogo/grupos", "Novo grupo", ["catalog.products.read"], ["catalog"]],
    ["/catalogo/produtos/novo", "Produtos", "/catalogo/produtos", "Novo produto", ["catalog.products.read"], ["catalog"]],
    ["/configuracoes/recursos/novo", "Recursos", "/configuracoes/recursos", "Novo recurso", ["rentals.assets.read", "core.units.read"], []],
    ["/os/nova", "Ordens de serviço", "/os", "Nova Ordem de Serviço", [], []],
    ["/pmoc/novo", "Planos de manutenção", "", "Novo plano", [], []],
    ["/pessoas-e-acesso/funcoes/nova", "Pessoas e acesso", "/pessoas-e-acesso", "Nova função", [], []],
    ["/ativos/novo", "Equipamentos", "/ativos", "Novo equipamento", [], []],
    ["/ativos/categorias/novo", "Tipos de equipamento", "/ativos/categorias", "Novo tipo", [], []],
  ] as const)("names %s with a singular create label", (path, parent, href, label, extraPermissions, extraModules) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <TestPermissionProvider
          permissions={[...permissions, ...extraPermissions]}
          activeModules={["pmoc", "os", "inventory", "rentals", ...extraModules]}
        >
          <BreadcrumbTitleProvider>
            <Breadcrumb />
          </BreadcrumbTitleProvider>
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    const nav = screen.getByRole("navigation", { name: "Caminho de navegação" })
    if (href) {
      expect(within(nav).getByRole("link", { name: parent })).toHaveAttribute("href", href)
    } else {
      expect(within(nav).getByText(parent)).toBeInTheDocument()
    }
    expect(nav.querySelector("[aria-current='page']")).toHaveTextContent(label)
    expect(within(nav).queryByText("Detalhes")).not.toBeInTheDocument()
    expect(within(nav).queryByText(/Novo Recursos|Novo Equipamentos|Novo Ordens|Novo Tipos/)).not.toBeInTheDocument()
  })
})


it("gives breadcrumb links 44px tap targets without increasing the line height", () => {
  renderBreadcrumb("/pmoc/plan-1", "Plano A")
  expect(screen.getByRole("link", { name: "Meus planos" })).toHaveClass("min-h-[44px]", "-my-3")
})


it.each(["/agendas", "/agendas/recursos", "/agendas/produto"])("does not repeat the top-level agenda heading in a breadcrumb at %s", (path) => {
  renderBreadcrumb(path)
  expect(screen.queryByRole("navigation", { name: "Caminho de navegação" })).not.toBeInTheDocument()
})

describe("Pedidos child breadcrumb", () => {
  it("uses the parent back link and order number with a slash", () => {
    renderBreadcrumb("/pedidos/order-1", "#7")
    const nav = screen.getByRole("navigation", { name: i18n.t("nav.breadcrumbLabel") })
    expect(within(nav).getByRole("link", { name: i18n.t("nav.pedidos") })).toHaveAttribute("href", "/pedidos")
    expect(within(nav).getByText("#7")).toHaveAttribute("aria-current", "page")
    expect(within(nav).getByText("/")).toBeInTheDocument()
    expect(nav.querySelector("svg.lucide-chevron-right")).not.toBeInTheDocument()
  })
  it("does not repeat the unified list title", () => {
    renderBreadcrumb("/pedidos")
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  })
})

it.each([
  ["/manutencao/planos/novo", "Novo plano"],
  ["/manutencao/ordens/nova", "Nova ordem"],
])("links the new child breadcrumb back to maintenance at %s", (path, title) => {
  renderBreadcrumb(path)
  const nav = screen.getByRole("navigation", { name: i18n.t("nav.breadcrumbLabel") })
  expect(within(nav).getByRole("link", { name: "Manutenção" })).toHaveAttribute("href", "/manutencao")
  expect(within(nav).getByText(title)).toHaveAttribute("aria-current", "page")
  expect(within(nav).getByText("/")).toBeInTheDocument()
})
it("does not repeat the maintenance list title in a breadcrumb", () => {
  renderBreadcrumb("/manutencao")
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
})
