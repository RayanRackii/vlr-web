import type { ReactElement } from "react"
import { Building2 } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { lazyPage } from "@/routes/lazyPage"

const CompanyProfilePage = lazyPage(() => import("@/features/company/pages/CompanyProfilePage"), "CompanyProfilePage")

type FeatureRoute = { path: string; element: ReactElement }

/**
 * The tenant's own company data. Any staff member may open it (the API enforces core.company.write
 * on save), so the route has no permission gate; the page is read-only without that key.
 */
export const companyManifest = {
  modules: [],
  permissions: ["core.company.write"],
  navigationItems: [
    {
      labelKey: "nav.company",
      to: "/configuracoes/empresa",
      icon: Building2,
      permissions: ["core.company.write", "core.dashboard.read"],
      anyOf: true,
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      { path: "/configuracoes/empresa", element: <CompanyProfilePage /> },
    ] satisfies readonly FeatureRoute[],
  },
} as const
