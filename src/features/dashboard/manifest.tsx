import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { LayoutDashboard } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"

const DashboardPage = lazyPage(() => import("@/features/dashboard/pages/DashboardPage"), "DashboardPage")

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
}

export const dashboardManifest = {
  modules: [],
  permissions: ["core.dashboard.read"],
  navigationItems: [
    {
      labelKey: "nav.dashboard",
      to: "/dashboard",
      icon: LayoutDashboard,
      permission: "core.dashboard.read",
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
        permission: "core.dashboard.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
