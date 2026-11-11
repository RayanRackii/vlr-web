import { ProductCadastroCreatePage } from "@/features/assistant/ProductCadastroCreatePage"
import { PedidosPage } from "./pages/PedidosPage"
import { PedidoRequestDetailPage } from "./pages/PedidoRequestDetailPage"
import { CatalogCustomerGroupEditorPage } from "@/features/catalog/pages/CatalogCustomerGroupEditorPage"
import type { ReactElement } from "react"
import { CalendarDays, FileText, Package, Settings, ShoppingBag, Tag, Users } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { Navigate } from "react-router-dom"
import { CatalogProductAgendaPage } from "@/features/catalog/pages/CatalogProductAgendaPage"
import { CatalogResourceAgendaPage } from "@/features/catalog/pages/CatalogResourceAgendaPage"
import { CatalogOrderDetailPage } from "@/features/catalog/pages/CatalogOrderDetailPage"
import { CatalogOrdersPage } from "@/features/catalog/pages/CatalogOrdersPage"
import { CatalogPolicyPage } from "@/features/catalog/pages/CatalogPolicyPage"
import { CatalogCustomerGroupsPage } from "@/features/catalog/pages/CatalogCustomerGroupsPage"
import { CatalogProductCreatePage } from "@/features/catalog/pages/CatalogProductCreatePage"
import { CatalogProductEditorPage } from "@/features/catalog/pages/CatalogProductEditorPage"
import { ProductWizardPage } from "@/features/catalog/pages/ProductWizardPage"
import { ProductAssistantPage } from "@/features/assistant/ProductAssistantPage"
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
          labelKey: "nav.catalogCustomerGroups",
          icon: Users,
          to: "/catalogo/grupos",
          permission: "catalog.products.read",
        },
        {
          labelKey: "nav.catalogOrders",
          icon: ShoppingBag,
          to: "/catalogo/pedidos",
          permission: "catalog.orders.read",
        },
        {
          labelKey: "nav.catalogProductAgenda",
          icon: CalendarDays,
          to: "/catalogo/agenda-produto",
          permission: "catalog.orders.read",
        },
        {
          labelKey: "nav.catalogResourceAgenda",
          icon: CalendarDays,
          to: "/catalogo/agenda-recursos",
          permission: "rentals.schedule.read",
          modules: ["rentals"],
        },
        {
          labelKey: "nav.catalogRequests",
          icon: FileText,
          to: "/catalogo/solicitacoes",
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
        element: <CatalogProductCreatePage />,
        permission: "catalog.products.manage",
      },
      {
        path: "/catalogo/produtos/:id/assistente",
        element: <ProductWizardPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/produtos/:id/passos",
        element: <ProductAssistantPage />,
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
        element: <CatalogProductsPage view="requests" />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/grupos",
        element: <CatalogCustomerGroupsPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/grupos/novo",
        element: <CatalogCustomerGroupEditorPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/grupos/:id",
        element: <CatalogCustomerGroupEditorPage />,
        permission: "catalog.products.read",
      },
      {
        path: "/catalogo/pedidos",
        element: <CatalogOrdersPage />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/agenda-produto",
        element: <CatalogProductAgendaPage />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/agenda-recursos",
        element: <CatalogResourceAgendaPage />,
        permission: "rentals.schedule.read",
        modules: ["rentals"],
      },
      {
        path: "/catalogo/pedidos/:orderId",
        element: <CatalogOrderDetailPage />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/notificacoes",
        element: <Navigate to="/configuracoes/notificacoes#entregas" replace />,
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
