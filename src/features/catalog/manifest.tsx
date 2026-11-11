import { ProductCadastroCreatePage } from "@/features/assistant/ProductCadastroCreatePage"
import { PedidosPage } from "./pages/PedidosPage"
import { PedidoRequestDetailPage } from "./pages/PedidoRequestDetailPage"
import type { ReactElement } from "react"
import { Package, Settings, Tag } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { CatalogOrderDetailPage } from "@/features/catalog/pages/CatalogOrderDetailPage"
import { CatalogPolicyPage } from "@/features/catalog/pages/CatalogPolicyPage"
import { CustomerGroupFormPage } from "@/features/catalog/pages/CustomerGroupFormPage"
import { CustomerGroupsPage } from "@/features/catalog/pages/CustomerGroupsPage"
import { CatalogProductEditorPage } from "@/features/catalog/pages/CatalogProductEditorPage"
import { ProductAssistantPage } from "@/features/assistant/ProductAssistantPage"
import {
  CadastroLegacyRedirect,
  NotificationsLegacyRedirect,
  OrdersListLegacyRedirect,
  RedirectKeepingLocation,
  RequestsListLegacyRedirect,
} from "@/routes/legacyScreenRedirect"
import { CatalogProductsPage } from "@/features/catalog/pages/CatalogProductsPage"
import { PortalCartPage } from "@/features/catalog/pages/PortalCartPage"
import { PortalCatalogPage } from "@/features/catalog/pages/PortalCatalogPage"
import { PortalCatalogProductPage } from "@/features/catalog/pages/PortalCatalogProductPage"
import { PortalOrderDetailPage } from "@/features/catalog/pages/PortalOrderDetailPage"
import { PortalOrdersPage } from "@/features/catalog/pages/PortalOrdersPage"
import { PortalProductRequestDetailPage } from "@/features/catalog/pages/PortalProductRequestDetailPage"
import { PortalProductRequestPage } from "@/features/catalog/pages/PortalProductRequestPage"
import { PortalProductRequestsPage } from "@/features/catalog/pages/PortalProductRequestsPage"

type FeatureRoute = {
  path: string
  element: ReactElement
  permission?: string
  anyOf?: readonly string[]
  /** Canonical tenant module keys that unlock this route. Absent = catalog only. */
  modules?: readonly string[]
}

export const catalogManifest = {
  modules: ["catalog"],
  permissions: [
    "catalog.products.read",
    "catalog.orders.read",
    "catalog.products.manage",
    "catalog.notifications.read",
    "rentals.schedule.read",
  ],
  navigationItems: [
    {
      labelKey: "nav.catalog",
      to: "/catalogo/produtos",
      icon: Package,
      modules: ["catalog"],
      children: [
        {
          labelKey: "nav.catalogProducts",
          icon: Tag,
          to: "/catalogo/produtos",
          permission: "catalog.products.read",
        },
        {
          labelKey: "nav.catalogSettings",
          icon: Settings,
          to: "/catalogo/configuracoes",
          permission: "catalog.products.manage",
        },
      ],
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    customer: [
      { path: "catalogo", element: <PortalCatalogPage /> },
      { path: "catalogo/carrinho", element: <PortalCartPage /> },
      { path: "catalogo/solicitar", element: <PortalProductRequestPage /> },
      { path: "catalogo/solicitacoes", element: <PortalProductRequestsPage /> },
      {
        path: "catalogo/solicitacoes/:requestId",
        element: <PortalProductRequestDetailPage />,
      },
      { path: "catalogo/:productId", element: <PortalCatalogProductPage /> },
      { path: "pedidos", element: <PortalOrdersPage /> },
      { path: "pedidos/:orderId", element: <PortalOrderDetailPage /> },
    ] satisfies readonly FeatureRoute[],
    staff: [
      {
        path: "/pedidos",
        element: <PedidosPage />,
        permission: "catalog.orders.read",
        anyOf: ["catalog.products.read"],
        modules: ["catalog"],
      },
      {
        path: "/pedidos/solicitacoes/:requestId",
        element: <PedidoRequestDetailPage />,
        permission: "catalog.products.read",
        modules: ["catalog"],
      },
      {
        path: "/pedidos/:orderId",
        element: <CatalogOrderDetailPage unified />,
        permission: "catalog.orders.read",
        modules: ["catalog"],
      },
      {
        path: "/catalogo/configuracoes",
        element: <CatalogPolicyPage />,
        permission: "catalog.products.manage",
      },
      { path: "/catalogo/produtos/cadastro", element: <ProductCadastroCreatePage />, permission: "catalog.products.manage" },
      { path: "/catalogo/produtos/:id/cadastro", element: <ProductAssistantPage cadastro />, permission: "catalog.products.read" },
      {
        path: "/catalogo/produtos/novo",
        element: <RedirectKeepingLocation to="/catalogo/produtos/cadastro" />,
        permission: "catalog.products.manage",
      },
      {
        path: "/catalogo/produtos/:id/assistente",
        element: <CadastroLegacyRedirect area="produtos" />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/produtos/:id/passos",
        element: <CadastroLegacyRedirect area="produtos" />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/produtos/:id",
        element: <CatalogProductEditorPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/produtos",
        element: <CatalogProductsPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/solicitacoes",
        element: <RequestsListLegacyRedirect />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/grupos",
        element: <RedirectKeepingLocation to="/grupos" />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/grupos/novo",
        element: <RedirectKeepingLocation to="/grupos/novo" />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/grupos/:id",
        element: <RedirectKeepingLocation to="/grupos/:id" />,
        permission: "catalog.products.read",
      },
      {
        path: "/grupos",
        element: <CustomerGroupsPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/grupos/novo",
        element: <CustomerGroupFormPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/grupos/:id",
        element: <CustomerGroupFormPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/pedidos",
        element: <OrdersListLegacyRedirect />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/agenda-produto",
        element: <RedirectKeepingLocation to="/agendas/produto" />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/agenda-recursos",
        element: <RedirectKeepingLocation to="/agendas/recursos" />,
        permission: "rentals.schedule.read",
        modules: ["rentals"],
      },
      {
        path: "/catalogo/pedidos/:orderId",
        element: <RedirectKeepingLocation to="/pedidos/:orderId" />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/notificacoes",
        element: <NotificationsLegacyRedirect history />,
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
