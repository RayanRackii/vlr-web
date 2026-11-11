import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { catalogManifest } from "@/features/catalog/manifest"

describe("staff sales navigation", () => {
  it("keeps the requests route permission and leaves it out of the sidebar", () => {
    const requestRoute = catalogManifest.routes.staff.find((route) => route.path === "/catalogo/solicitacoes")
    const requestItem = catalogManifest.navigationItems[0].children.find((item) => item.to === "/catalogo/solicitacoes" || item.to === "/pedidos")
    expect(requestRoute?.permission).toBe("catalog.products.read")
    expect(requestItem).toBeUndefined()
    expect(catalogManifest.modules).toEqual(["catalog"])
  })

  it("preserves every existing staff route and permission", () => {
    expect(catalogManifest.routes.staff.filter((route) => route.path !== "/catalogo/solicitacoes" && !route.path.startsWith("/pedidos")).map(({ path, permission }) => ({ path, permission }))).toEqual([
      { path: "/catalogo/configuracoes", permission: "catalog.products.manage" },
      { path: "/catalogo/produtos/cadastro", permission: "catalog.products.manage" },
      { path: "/catalogo/produtos/:id/cadastro", permission: "catalog.products.read" },
      { path: "/catalogo/produtos/novo", permission: "catalog.products.manage" },
      { path: "/catalogo/produtos/:id/assistente", permission: "catalog.products.read" },
      { path: "/catalogo/produtos/:id/passos", permission: "catalog.products.read" },
      { path: "/catalogo/produtos/:id", permission: "catalog.products.read" },
      { path: "/catalogo/produtos", permission: "catalog.products.read" },
      { path: "/catalogo/grupos", permission: "catalog.products.read" },
      { path: "/catalogo/grupos/novo", permission: "catalog.products.read" },
      { path: "/catalogo/grupos/:id", permission: "catalog.products.read" },
      { path: "/grupos", permission: "catalog.products.read" },
      { path: "/grupos/novo", permission: "catalog.products.read" },
      { path: "/grupos/:id", permission: "catalog.products.read" },
      { path: "/catalogo/pedidos", permission: "catalog.orders.read" },
      { path: "/catalogo/agenda-produto", permission: "catalog.orders.read" },
      { path: "/catalogo/agenda-recursos", permission: "rentals.schedule.read" },
      { path: "/catalogo/pedidos/:orderId", permission: "catalog.orders.read" },
      { path: "/catalogo/notificacoes", permission: undefined },
    ])
  })

  it("sends the sales notifications path to the shared notifications page", () => {
    const route = catalogManifest.routes.staff.find((item) => item.path === "/catalogo/notificacoes")
    render(
      <MemoryRouter initialEntries={["/catalogo/notificacoes"]}>
        <Routes>
          <Route path="/catalogo/notificacoes" element={route?.element} />
          <Route path="/notificacoes" element={<h1>Notificações</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole("heading", { name: "Notificações" })).toBeInTheDocument()
    expect(route?.permission).toBeUndefined()
    const labels: string[] = (catalogManifest.navigationItems[0]?.children ?? []).map((item) => item.labelKey)
    expect(labels).not.toContain("nav.catalogNotifications")
  })
})

describe("unified Pedidos routes", () => {
  it("adds module-gated staff routes with read permissions", () => {
    expect(catalogManifest.routes.staff.find(route => route.path === "/pedidos")).toMatchObject({ permission: "catalog.orders.read", anyOf: ["catalog.products.read"], modules: ["catalog"] })
    expect(catalogManifest.routes.staff.find(route => route.path === "/pedidos/:orderId")).toMatchObject({ permission: "catalog.orders.read", modules: ["catalog"] })
    expect(catalogManifest.routes.staff.find(route => route.path === "/pedidos/solicitacoes/:requestId")).toMatchObject({ permission: "catalog.products.read", modules: ["catalog"] })
  })
})
