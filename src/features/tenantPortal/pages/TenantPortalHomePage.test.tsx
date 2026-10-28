import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"

import { TenantPortalHomePage } from "@/features/tenantPortal/pages/TenantPortalHomePage"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"

const RENTALS_ID = "11111111-1111-4111-8111-111111111111"
const CATALOG_ID = "22222222-2222-4222-8222-222222222222"

const rentalsItem: ModuleMenuItem = {
  id: RENTALS_ID,
  moduleName: "rentals",
  label: "Reservar horário",
  sortOrder: 0,
  isActive: true,
}
const catalogItem: ModuleMenuItem = {
  id: CATALOG_ID,
  moduleName: "catalog",
  label: "Catálogo",
  sortOrder: 1,
  isActive: true,
}

function contextWith(menu: ModuleMenuItem[]): CustomerAppOutletContext {
  return {
    subdomain: "clube",
    branding: {
      subdomain: "clube",
      displayName: "Clube Teste",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    },
    primary: "#123456",
    menu,
  }
}

function renderHome(menu: ModuleMenuItem[]) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={contextWith(menu)} />}>
          <Route path="/" element={<TenantPortalHomePage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => clearCustomerSession())

describe("TenantPortalHomePage", () => {
  it("greets the signed-in customer by first name", () => {
    persistCustomerSession("token", "clube", "Marina Souza")
    renderHome([rentalsItem, catalogItem])

    expect(screen.getByText("Olá, Marina 👋")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Início" }),
    ).toBeInTheDocument()
  })

  it("shows a hero that links to Reservar horário when rentals is enabled", () => {
    persistCustomerSession("token", "clube", "Marina")
    renderHome([rentalsItem, catalogItem])

    const hero = screen.getByRole("region", {
      name: "O que você quer fazer hoje?",
    })
    const primary = within(hero).getByRole("link", { name: /Reservar horário/ })
    expect(primary).toHaveAttribute(
      "href",
      `/t/clube/agenda/${RENTALS_ID}`,
    )
    expect(
      within(hero).getByRole("link", { name: /Minhas reservas/ }),
    ).toBeInTheDocument()
  })

  it("renders a quick-action tile for each enabled module", () => {
    persistCustomerSession("token", "clube", "Marina")
    renderHome([rentalsItem, catalogItem])

    const quickActions = screen.getByRole("list", { name: "Acesso rápido" })
    const tiles = within(quickActions).getAllByRole("listitem")
    // Reservar, Catálogo, Pedidos, Minhas solicitações, Minhas reservas
    expect(tiles).toHaveLength(5)
    expect(
      within(quickActions).getByRole("link", { name: /Catálogo/ }),
    ).toHaveAttribute("href", "/t/clube/catalogo")
  })

  it("falls back to the catalog hero when there is no rentals module", () => {
    persistCustomerSession("token", "clube", "Marina")
    renderHome([catalogItem])

    const hero = screen.getByRole("region", {
      name: "O que você quer fazer hoje?",
    })
    const primary = within(hero).getByRole("link", { name: /Catálogo/ })
    expect(primary).toHaveAttribute("href", "/t/clube/catalogo")
  })

  it("shows a friendly empty state when no modules are available", () => {
    persistCustomerSession("token", "clube", "Marina")
    renderHome([])

    expect(screen.getByText("Nada por aqui ainda")).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Acesso rápido" })).toBeNull()
  })
})
