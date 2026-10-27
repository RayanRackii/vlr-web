import type { ReactElement } from "react"
import { Wrench } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { equipmentTabs } from "@/features/assets/navigationTabs"
import { EquipmentPage } from "@/features/assets/pages/EquipmentPage"

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
        path: "/ativos",
        element: <EquipmentPage />,
        permission: "inventory.assets.read",
      },
      {
        path: "/ativos/categorias",
        element: <EquipmentPage />,
        permission: "inventory.categories.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
