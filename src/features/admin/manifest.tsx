import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Shield } from "lucide-react"
import { Navigate } from "react-router-dom"

import type { AppNavigationItem } from "@/components/layout/navigation"

const AdminAssetFamiliesPage = lazyPage(() => import("@/features/admin/pages/AdminAssetFamiliesPage"), "AdminAssetFamiliesPage")
const AdminDashboardPage = lazyPage(() => import("@/features/admin/pages/AdminDashboardPage"), "AdminDashboardPage")
const AdminUsersPage = lazyPage(() => import("@/features/admin/pages/AdminUsersPage"), "AdminUsersPage")
const EditTenantPage = lazyPage(() => import("@/features/admin/pages/EditTenantPage"), "EditTenantPage")
const NewTenantPage = lazyPage(() => import("@/features/admin/pages/NewTenantPage"), "NewTenantPage")
const ResourceVisualCatalogPage = lazyPage(() => import("@/features/admin/pages/ResourceVisualCatalogPage"), "ResourceVisualCatalogPage")
const TenantModuleMenuPage = lazyPage(() => import("@/features/admin/pages/TenantModuleMenuPage"), "TenantModuleMenuPage")
const PeopleAccessPage = lazyPage(() => import("@/features/users/pages/PeopleAccessPage"), "PeopleAccessPage")

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
      { path: "/configuracoes/cadastro", element: <PeopleAccessPage />, permission: "core.registration_fields.read" },
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
