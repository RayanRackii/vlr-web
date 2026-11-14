import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Tags } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"

const TaxonomyPage = lazyPage(() => import("@/features/taxonomy/pages/TaxonomyPage"), "TaxonomyPage")

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
}

export const taxonomyManifest = {
  modules: [],
  permissions: ["core.taxonomy.read"],
  navigationItems: [
    {
      labelKey: "nav.taxonomy",
      to: "/configuracoes/categorias-tags",
      icon: Tags,
      permission: "core.taxonomy.read",
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/configuracoes/categorias-tags",
        element: <TaxonomyPage />,
        permission: "core.taxonomy.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
