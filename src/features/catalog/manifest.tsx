import type { ReactElement } from "react"
import { Bell, FileText, Package, Settings, ShoppingBag, Tag } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { CatalogNotificationsPage } from "@/features/catalog/pages/CatalogNotificationsPage"
import { CatalogOrderDetailPage } from "@/features/catalog/pages/CatalogOrderDetailPage"
import { CatalogOrdersPage } from "@/features/catalog/pages/CatalogOrdersPage"
import { CatalogPolicyPage } from "@/features/catalog/pages/CatalogPolicyPage"
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
}

export const catalogManifest = {
  modules: ["catalog"],
  permissions: [
    "catalog.products.read",
    "catalog.orders.read",
    "catalog.products.manage",
    "catalog.notifications.read",
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
          labelKey: "nav.catalogOrders",
          icon: ShoppingBag,
          to: "/catalogo/pedidos",
          permission: "catalog.orders.read",
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
        {
          labelKey: "nav.catalogNotifications",
          icon: Bell,
          to: "/catalogo/notificacoes",
          permission: "catalog.notifications.read",
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
        path: "/catalogo/configuracoes",
        element: <CatalogPolicyPage />,
        permission: "catalog.products.manage",
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
        path: "/catalogo/pedidos",
        element: <CatalogOrdersPage />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/pedidos/:orderId",
        element: <CatalogOrderDetailPage />,
        permission: "catalog.orders.read",
      },
      {
        path: "/catalogo/notificacoes",
        element: <CatalogNotificationsPage />,
        permission: "catalog.notifications.read",
      },
    ] satisfies readonly Required<FeatureRoute>[],
  },
} as const
