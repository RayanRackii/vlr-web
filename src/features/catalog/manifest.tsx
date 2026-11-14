import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Package, Settings, Tag } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import {
  CadastroLegacyRedirect,
  NotificationsLegacyRedirect,
  OrdersListLegacyRedirect,
  RedirectKeepingLocation,
  RequestsListLegacyRedirect,
} from "@/routes/legacyScreenRedirect"

const ProductCadastroCreatePage = lazyPage(() => import("@/features/assistant/ProductCadastroCreatePage"), "ProductCadastroCreatePage")
const PedidosPage = lazyPage(() => import("./pages/PedidosPage"), "PedidosPage")
const PedidoRequestDetailPage = lazyPage(() => import("./pages/PedidoRequestDetailPage"), "PedidoRequestDetailPage")
const CatalogOrderDetailPage = lazyPage(() => import("@/features/catalog/pages/CatalogOrderDetailPage"), "CatalogOrderDetailPage")
const CatalogPolicyPage = lazyPage(() => import("@/features/catalog/pages/CatalogPolicyPage"), "CatalogPolicyPage")
const CustomerGroupFormPage = lazyPage(() => import("@/features/catalog/pages/CustomerGroupFormPage"), "CustomerGroupFormPage")
const CustomerGroupsPage = lazyPage(() => import("@/features/catalog/pages/CustomerGroupsPage"), "CustomerGroupsPage")
const CatalogProductEditorPage = lazyPage(() => import("@/features/catalog/pages/CatalogProductEditorPage"), "CatalogProductEditorPage")
const ProductAssistantPage = lazyPage(() => import("@/features/assistant/ProductAssistantPage"), "ProductAssistantPage")
const CatalogProductsPage = lazyPage(() => import("@/features/catalog/pages/CatalogProductsPage"), "CatalogProductsPage")
const PortalCartPage = lazyPage(() => import("@/features/catalog/pages/PortalCartPage"), "PortalCartPage")
const PortalCatalogPage = lazyPage(() => import("@/features/catalog/pages/PortalCatalogPage"), "PortalCatalogPage")
const PortalCatalogProductPage = lazyPage(() => import("@/features/catalog/pages/PortalCatalogProductPage"), "PortalCatalogProductPage")
const PortalOrderDetailPage = lazyPage(() => import("@/features/catalog/pages/PortalOrderDetailPage"), "PortalOrderDetailPage")
const PortalOrdersPage = lazyPage(() => import("@/features/catalog/pages/PortalOrdersPage"), "PortalOrdersPage")
const PortalProductRequestDetailPage = lazyPage(() => import("@/features/catalog/pages/PortalProductRequestDetailPage"), "PortalProductRequestDetailPage")
const PortalProductRequestPage = lazyPage(() => import("@/features/catalog/pages/PortalProductRequestPage"), "PortalProductRequestPage")
const PortalProductRequestsPage = lazyPage(() => import("@/features/catalog/pages/PortalProductRequestsPage"), "PortalProductRequestsPage")

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
