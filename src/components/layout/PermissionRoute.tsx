import { Outlet } from "react-router-dom"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { holdsRoutePermission, resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

type PermissionRouteProps = {
  permission?: string
  permissions?: readonly string[]
  /** Extra keys that also open the route. Any one of `permission` or these is enough. */
  anyOf?: readonly string[]
  /** Canonical tenant module keys that must be active. Absent/empty = no module gate. */
  modules?: readonly string[]
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
  anyOf,
  modules,
}: PermissionRouteProps) {
  const { can, isLoading, activeModules } = usePermissions()
  const { isPlatformAdmin, isInTenantEnvironment } = usePlatformTenantSession()
  const required = requiredPermissionKeys({ permission, permissions })
  const moduleEnabled =
    !modules || modules.length === 0 || modules.some((module) => activeModules.includes(module))

  const access = resolvePermissionRouteAccess({
    isLoading,
    hasPermission: moduleEnabled && holdsRoutePermission({ permission, permissions, anyOf }, can),
    isPlatformAdminOutsideTenant: isPlatformAdmin && !isInTenantEnvironment,
    permission: required[0] ?? anyOf?.[0] ?? "",
  })

  if (access === "loading") {
    return <PageContentSkeleton />
  }

  if (access === "deny") {
    return <AccessDeniedPage />
  }

  return <Outlet />
}
