import type { ReactElement } from "react"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { expect, it } from "vitest"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import {
  CadastroLegacyRedirect,
  MaintenanceListLegacyRedirect,
  NotificationsLegacyRedirect,
  OrdersListLegacyRedirect,
  RedirectKeepingLocation,
  RequestsListLegacyRedirect,
  ResourceLegacyRedirect,
} from "@/routes/legacyScreenRedirect"

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</span>
}

function visit(entry: string, pattern: string, element: ReactElement, permissions = ["rentals.assets.write", "core.units.read"]) {
  render(<MemoryRouter initialEntries={[entry]}>
    <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}>
      <Routes>
        <Route path={pattern} element={element} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </TestPermissionProvider>
  </MemoryRouter>)
}

it.each([
  ["/agenda?visao=semana&date=2026-11-10", "/agenda", <RedirectKeepingLocation to="/agendas" />, "/agendas?visao=semana&date=2026-11-10"],
  ["/catalogo/agenda-recursos?date=2026-11-10", "/catalogo/agenda-recursos", <RedirectKeepingLocation to="/agendas/recursos" />, "/agendas/recursos?date=2026-11-10"],
  ["/catalogo/agenda-produto?produto=abc", "/catalogo/agenda-produto", <RedirectKeepingLocation to="/agendas/produto" />, "/agendas/produto?produto=abc"],
  ["/catalogo/pedidos?q=ana", "/catalogo/pedidos", <OrdersListLegacyRedirect />, "/pedidos?q=ana&aba=pedidos"],
  ["/catalogo/pedidos?visao=agenda&date=2026-11-10", "/catalogo/pedidos", <OrdersListLegacyRedirect />, "/agendas/produto?date=2026-11-10"],
  ["/catalogo/solicitacoes?q=ana", "/catalogo/solicitacoes", <RequestsListLegacyRedirect />, "/pedidos?q=ana&aba=solicitacoes"],
  ["/catalogo/pedidos/order-1?aba=pedidos", "/catalogo/pedidos/:orderId", <RedirectKeepingLocation to="/pedidos/:orderId" />, "/pedidos/order-1?aba=pedidos"],
  ["/pmoc?q=filtro", "/pmoc", <MaintenanceListLegacyRedirect aba="planos" />, "/manutencao?q=filtro&aba=planos"],
  ["/pmoc/novo", "/pmoc/novo", <RedirectKeepingLocation to="/manutencao/planos/novo" />, "/manutencao/planos/novo"],
  ["/os", "/os", <MaintenanceListLegacyRedirect aba="ordens" />, "/manutencao?aba=ordens"],
  ["/os/nova?plano=plan-1", "/os/nova", <RedirectKeepingLocation to="/manutencao/ordens/nova" />, "/manutencao/ordens/nova?plano=plan-1"],
  ["/catalogo/grupos?q=vip", "/catalogo/grupos", <RedirectKeepingLocation to="/grupos" />, "/grupos?q=vip"],
  ["/catalogo/grupos/novo?returnTo=%2Fpedidos", "/catalogo/grupos/novo", <RedirectKeepingLocation to="/grupos/novo" />, "/grupos/novo?returnTo=%2Fpedidos"],
  ["/catalogo/grupos/group-1?returnTo=%2Fpedidos", "/catalogo/grupos/:id", <RedirectKeepingLocation to="/grupos/:id" />, "/grupos/group-1?returnTo=%2Fpedidos"],
  ["/configuracoes/notificacoes#entregas", "/configuracoes/notificacoes", <NotificationsLegacyRedirect />, "/notificacoes?aba=historico"],
  ["/configuracoes/notificacoes?tab=catalog", "/configuracoes/notificacoes", <NotificationsLegacyRedirect />, "/notificacoes"],
  ["/catalogo/notificacoes", "/catalogo/notificacoes", <NotificationsLegacyRedirect history />, "/notificacoes?aba=historico"],
  ["/catalogo/produtos/novo", "/catalogo/produtos/novo", <RedirectKeepingLocation to="/catalogo/produtos/cadastro" />, "/catalogo/produtos/cadastro"],
  ["/catalogo/produtos/p1/assistente?passo=offer", "/catalogo/produtos/:id/assistente", <CadastroLegacyRedirect area="produtos" />, "/catalogo/produtos/p1/cadastro?passo=precos"],
  ["/catalogo/produtos/p1/passos?passo=access", "/catalogo/produtos/:id/passos", <CadastroLegacyRedirect area="produtos" />, "/catalogo/produtos/p1/cadastro?passo=regras"],
  ["/catalogo/produtos/p1/passos?passo=publicacao&origem=lista", "/catalogo/produtos/:id/passos", <CadastroLegacyRedirect area="produtos" />, "/catalogo/produtos/p1/cadastro?passo=publicacao&origem=lista"],
  ["/configuracoes/recursos/novo", "/configuracoes/recursos/novo", <ResourceLegacyRedirect />, "/configuracoes/recursos/cadastro"],
  ["/configuracoes/recursos/r1/assistente?passo=rules", "/configuracoes/recursos/:id/assistente", <ResourceLegacyRedirect />, "/configuracoes/recursos/r1/cadastro?passo=agenda"],
  ["/configuracoes/recursos/r1/passos?passo=agenda", "/configuracoes/recursos/:id/passos", <ResourceLegacyRedirect />, "/configuracoes/recursos/r1/cadastro?passo=agenda"],
])("redirects %s to %s", (entry, pattern, element, to) => {
  visit(entry, pattern, element)
  expect(screen.getByTestId("location")).toHaveTextContent(to)
})

it.each([
  ["/configuracoes/recursos/novo", "/configuracoes/recursos/novo", "/configuracoes/recursos"],
  ["/configuracoes/recursos/r1/assistente?passo=rules", "/configuracoes/recursos/:id/assistente", "/configuracoes/recursos/r1"],
  ["/configuracoes/recursos/r1/passos", "/configuracoes/recursos/:id/passos", "/configuracoes/recursos/r1"],
])("sends a resource reader from %s to the page they can open", (entry, pattern, to) => {
  visit(entry, pattern, <ResourceLegacyRedirect />, ["rentals.assets.read", "core.units.read"])
  expect(screen.getByTestId("location").textContent).toBe(to)
})
