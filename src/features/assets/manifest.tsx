import { Navigate } from "react-router-dom"
import { lazyPage } from "@/routes/lazyPage"
import type { ReactElement } from "react"
import { Wrench } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { equipmentTabs } from "@/features/assets/navigationTabs"

const AssetCreatePage = lazyPage(() => import("@/features/assets/pages/AssetCreatePage"), "AssetCreatePage")
const CategoryLegacyRedirect = lazyPage(() => import("@/features/assets/pages/CategoryLegacyRedirect"), "CategoryLegacyRedirect")
const EquipmentPage = lazyPage(() => import("@/features/assets/pages/EquipmentPage"), "EquipmentPage")
const ResourceTypeWizardPage = lazyPage(() => import("@/features/assets/pages/ResourceTypeWizardPage"), "ResourceTypeWizardPage")

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
}

export const assetsManifest = {
  modules: ["inventory"],
  permissions: ["inventory.assets.read", "inventory.categories.read"],
  navigationItems: [
    {
      labelKey: "nav.assets",
      to: "/ativos",
      icon: Wrench,
      modules: ["inventory"],
      tabs: equipmentTabs,
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/ativos/novo",
        element: <AssetCreatePage />,
        permission: "inventory.assets.write",
      },
      {
        path: "/ativos",
        element: <EquipmentPage />,
        permission: "inventory.assets.read",
      },
      {
        path: "/ativos/tipos/novo",
        element: <ResourceTypeWizardPage />,
        permission: "inventory.categories.write",
      },
      {
        path: "/ativos/tipos/:typeId",
        element: <ResourceTypeWizardPage />,
        permission: "inventory.categories.write",
      },
      {
        path: "/ativos/tipos",
        element: <EquipmentPage />,
        permission: "inventory.categories.read",
      },
      {
        path: "/ativos/categorias/novo",
        element: <Navigate to="/ativos/tipos/novo" replace />,
        permission: "inventory.categories.write",
      },
      {
        path: "/ativos/categorias/novo/",
        element: <Navigate to="/ativos/tipos/novo" replace />,
        permission: "inventory.categories.write",
      },
      {
        path: "/ativos/categorias",
        element: <Navigate to="/ativos/tipos" replace />,
        permission: "inventory.categories.read",
      },
      {
        path: "/ativos/categorias/",
        element: <Navigate to="/ativos/tipos" replace />,
        permission: "inventory.categories.read",
      },
      {
        path: "/ativos/categorias/*",
        element: <CategoryLegacyRedirect />,
        permission: "inventory.categories.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
