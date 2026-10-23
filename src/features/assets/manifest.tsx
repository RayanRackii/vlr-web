import type { ReactElement } from "react"
import { Wrench } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { AssetCategoriesPage } from "@/features/assets/pages/AssetCategoriesPage"
import { AssetsPage } from "@/features/assets/pages/AssetsPage"

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
      children: [
        {
          labelKey: "nav.assetsInventory",
          to: "/ativos",
          permission: "inventory.assets.read",
        },
        {
          labelKey: "nav.assetsCategories",
          to: "/ativos/categorias",
          permission: "inventory.categories.read",
        },
      ],
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/ativos",
        element: <AssetsPage />,
        permission: "inventory.assets.read",
      },
      {
        path: "/ativos/categorias",
        element: <AssetCategoriesPage />,
        permission: "inventory.categories.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
