import type { ReactElement } from "react"
import { ClipboardList } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import { MaintenancePlansPage } from "@/features/pmoc/pages/MaintenancePlansPage"
import { PmocLibraryPage } from "@/features/pmoc/pages/PmocLibraryPage"
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
          labelKey: "nav.pmocLibrary",
          to: "/pmoc/biblioteca",
          permission: "pmoc.templates.read",
        },
        {
          labelKey: "nav.pmocNew",
          to: "/pmoc/novo",
          permission: "pmoc.plans.write",
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
        element: <PmocLibraryPage />,
        permission: "pmoc.templates.read",
      },
      {
        path: "/pmoc/biblioteca/:templateId",
        element: <PmocTemplatePreviewPage />,
        permission: "pmoc.templates.read",
      },
      {
        path: "/pmoc/novo",
        element: <CreatePlanPage />,
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
