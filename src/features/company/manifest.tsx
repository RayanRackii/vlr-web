import type { ReactElement } from "react"
import { Building2, Palette } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { lazyPage } from "@/routes/lazyPage"

const CompanyProfilePage = lazyPage(() => import("@/features/company/pages/CompanyProfilePage"), "CompanyProfilePage")

const PortalAppearancePage = lazyPage(() => import("@/features/company/pages/PortalAppearancePage"), "PortalAppearancePage")

type FeatureRoute = { path: string; element: ReactElement }

/**
 * The tenant's own company data. Any staff member may open it (the API enforces core.company.write
 * on save), so the routes have no permission gate; the pages are read-only without that key.
 * Also owns Aparência do portal (landing image and texts of the customer portal login).
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
    {
      labelKey: "nav.portalAppearance",
      to: "/configuracoes/aparencia",
      icon: Palette,
      permissions: ["core.company.write", "core.dashboard.read"],
      anyOf: true,
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      { path: "/configuracoes/empresa", element: <CompanyProfilePage /> },
      { path: "/configuracoes/aparencia", element: <PortalAppearancePage /> },
    ] satisfies readonly FeatureRoute[],
  },
} as const
