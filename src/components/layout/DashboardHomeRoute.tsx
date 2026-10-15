import { Navigate, Outlet } from "react-router-dom"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { firstPermittedProductPath } from "@/components/layout/navigation"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

const DASHBOARD_PERMISSION = "core.dashboard.read"

export function DashboardHomeRoute() {
  const { can, isLoading, permissions, activeModules } = usePermissions()
  const { isPlatformAdmin, isInTenantEnvironment } = usePlatformTenantSession()

  const access = resolvePermissionRouteAccess({
    isLoading,
    hasPermission: can(DASHBOARD_PERMISSION),
    isPlatformAdminOutsideTenant: isPlatformAdmin && !isInTenantEnvironment,
    permission: DASHBOARD_PERMISSION,
  })

  if (access === "loading") {
    return <PageContentSkeleton />
  }

  if (access === "allow") {
    return <Outlet />
  }

  const next = firstPermittedProductPath(activeModules, permissions)
  if (next && next !== "/dashboard") {
    return <Navigate to={next} replace />
  }

  return <AccessDeniedPage />
}
