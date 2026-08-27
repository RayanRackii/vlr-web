import type { ReactNode } from "react"

import { usePermissions } from "@/features/users/permissions/PermissionContext"

type CanProps = {
  permission: string
  children: ReactNode
}

export function Can({ permission, children }: CanProps) {
  const { can } = usePermissions()

  if (!can(permission)) {
    return null
  }

  return children
}
