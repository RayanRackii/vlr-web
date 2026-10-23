import type { ReactElement } from "react"
import { ClipboardPen } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { WorkOrdersPage } from "@/features/workOrders/pages/WorkOrdersPage"

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
        element: <WorkOrdersPage />,
        permission: "os.work_orders.read",
      },
      {
        path: "/os/:id",
        element: <WorkOrderExecutionPage />,
        permission: "os.work_orders.read",
      },
      {
        path: "/os/nova",
        element: <CreateWorkOrderPage />,
        permission: "os.work_orders.create",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
