import { Outlet } from "react-router-dom"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type PermissionRouteProps = {
  permission: string
}

export function PermissionRoute({ permission }: PermissionRouteProps) {
  const { can, isLoading } = usePermissions()
  const { isPlatformAdmin, isInTenantEnvironment } = usePlatformTenantSession()

  const access = resolvePermissionRouteAccess({
    isLoading,
    hasPermission: can(permission),
    isPlatformAdminOutsideTenant: isPlatformAdmin && !isInTenantEnvironment,
    permission,
  })

  if (access === "loading") {
    return <PageContentSkeleton />
  }

  if (access === "deny") {
    return <AccessDeniedPage />
  }

  return <Outlet />
}
