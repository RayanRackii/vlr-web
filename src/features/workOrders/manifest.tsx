import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { ClipboardPen } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { MaintenanceListLegacyRedirect, RedirectKeepingLocation } from "@/routes/legacyScreenRedirect"

const WorkOrderExecutionPage = lazyPage(() => import("@/features/workOrders/pages/WorkOrderExecutionPage"), "WorkOrderExecutionPage")

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
}

export const workOrdersManifest = {
  modules: ["os"],
  permissions: ["os.work_orders.read", "os.work_orders.create"],
  navigationItems: [
    {
      labelKey: "nav.workOrders",
      to: "/os",
      icon: ClipboardPen,
      modules: ["os"],
      permission: "os.work_orders.read",
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/os",
        element: <MaintenanceListLegacyRedirect aba="ordens" />,
        permission: "os.work_orders.read",
      },
      {
        path: "/os/:id",
        element: <WorkOrderExecutionPage />,
        permission: "os.work_orders.read",
      },
      {
        path: "/os/nova",
        element: <RedirectKeepingLocation to="/manutencao/ordens/nova" />,
        permission: "os.work_orders.create",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
