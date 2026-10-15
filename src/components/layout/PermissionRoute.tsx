import { Outlet } from "react-router-dom"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type PermissionRouteProps = {
  permission?: string
  permissions?: readonly string[]
}

function requiredPermissionKeys({
  permission,
  permissions,
}: PermissionRouteProps): string[] {
  const keys: string[] = []
  if (permission) {
    keys.push(permission)
  }

  for (const key of permissions ?? []) {
    if (!keys.includes(key)) {
      keys.push(key)
    }
  }

  return keys
}

export function PermissionRoute({
  permission,
  permissions,
}: PermissionRouteProps) {
  const { can, isLoading } = usePermissions()
  const { isPlatformAdmin, isInTenantEnvironment } = usePlatformTenantSession()
  const required = requiredPermissionKeys({ permission, permissions })

  const access = resolvePermissionRouteAccess({
    isLoading,
    hasPermission:
      required.length > 0 && required.every((key) => can(key)),
    isPlatformAdminOutsideTenant: isPlatformAdmin && !isInTenantEnvironment,
    permission: required[0] ?? "",
  })

  if (access === "loading") {
    return <PageContentSkeleton />
  }

  if (access === "deny") {
    return <AccessDeniedPage />
  }

  return <Outlet />
}
