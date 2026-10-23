import type { ReactElement } from "react"
import { Shield } from "lucide-react"
import { Navigate } from "react-router-dom"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { AdminAssetFamiliesPage } from "@/features/admin/pages/AdminAssetFamiliesPage"
import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import { AdminUsersPage } from "@/features/admin/pages/AdminUsersPage"
import { EditTenantPage } from "@/features/admin/pages/EditTenantPage"
import { NewTenantPage } from "@/features/admin/pages/NewTenantPage"
import { ResourceVisualCatalogPage } from "@/features/admin/pages/ResourceVisualCatalogPage"
import { TenantModuleMenuPage } from "@/features/admin/pages/TenantModuleMenuPage"
import { TenantRegistrationFieldsPage } from "@/features/admin/pages/TenantRegistrationFieldsPage"

type FeatureRoute = { path: string; element: ReactElement; permission?: string }

export const adminManifest = {
  modules: [],
  permissions: ["core.registration_fields.read", "core.module_menu.read"],
  navigationItems: [{
    labelKey: "nav.admin",
    to: "/admin/dashboard",
    icon: Shield,
    children: [
      { labelKey: "nav.adminTenants", to: "/admin/dashboard" },
      { labelKey: "nav.adminUsers", to: "/admin/users" },
      { labelKey: "nav.adminAssetFamilies", to: "/admin/asset-families" },
    ],
  }] satisfies readonly AppNavigationItem[],
  routes: {
    platformStandalone: [
      { path: "/admin/tenants", element: <Navigate to="/admin/dashboard" replace /> },
      { path: "/admin/tenants/new", element: <NewTenantPage /> },
      { path: "/admin/tenants/:id/edit", element: <EditTenantPage /> },
    ] satisfies readonly FeatureRoute[],
    staff: [
      { path: "/configuracoes/cadastro", element: <TenantRegistrationFieldsPage />, permission: "core.registration_fields.read" },
      { path: "/configuracoes/menu", element: <TenantModuleMenuPage />, permission: "core.module_menu.read" },
    ] satisfies readonly Required<FeatureRoute>[],
    platformShell: [
      { path: "/admin", element: <Navigate to="/admin/dashboard" replace /> },
      { path: "/admin/dashboard", element: <AdminDashboardPage /> },
      { path: "/admin/users", element: <AdminUsersPage /> },
      { path: "/admin/recursos-visuais", element: <ResourceVisualCatalogPage /> },
      { path: "/admin/tenants/:id/recursos-visuais", element: <ResourceVisualCatalogPage /> },
      { path: "/admin/asset-families", element: <AdminAssetFamiliesPage /> },
    ] satisfies readonly FeatureRoute[],
  },
} as const
