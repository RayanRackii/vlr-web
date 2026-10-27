import type { ReactElement } from "react"
import { ClipboardList } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { newPlanTabs } from "@/features/pmoc/navigationTabs"
import { NewPlanPage } from "@/features/pmoc/pages/NewPlanPage"
import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import { PmocPlanDetailPage } from "@/features/pmoc/pages/PmocPlanDetailPage"
import { PmocTemplatePreviewPage } from "@/features/pmoc/pages/PmocTemplatePreviewPage"

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
}

export const pmocManifest = {
  modules: ["pmoc"],
  permissions: ["pmoc.plans.read", "pmoc.templates.read", "pmoc.plans.write"],
  navigationItems: [
    {
      labelKey: "nav.pmoc",
      introKey: "pmoc",
      to: "/pmoc",
      icon: ClipboardList,
      modules: ["pmoc"],
      children: [
        {
          labelKey: "nav.pmocPlans",
          to: "/pmoc",
          permission: "pmoc.plans.read",
        },
        {
          labelKey: "nav.pmocNew",
          to: "/pmoc/novo",
          tabs: newPlanTabs,
        },
      ],
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/pmoc",
        element: <MaintenancePlansPage />,
        permission: "pmoc.plans.read",
      },
      {
        path: "/pmoc/biblioteca",
        element: <NewPlanPage />,
        permission: "pmoc.templates.read",
      },
      {
        path: "/pmoc/biblioteca/:templateId",
        element: <PmocTemplatePreviewPage />,
        permission: "pmoc.templates.read",
      },
      {
        path: "/pmoc/novo",
        element: <NewPlanPage />,
        permission: "pmoc.plans.write",
      },
      {
        path: "/pmoc/:id",
        element: <PmocPlanDetailPage />,
        permission: "pmoc.plans.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
