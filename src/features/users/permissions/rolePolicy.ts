export const SYSTEM_ROLE_NAMES = {
  SuperAdmin: "SuperAdmin",
  Admin: "Admin",
  User: "User",
  Technician: "Technician",
  Client: "Client",
} as const

export type TenantRoleRef = {
  id: string
  name: string
  isSystemRole: boolean
}

export type RoleEditorPolicy = {
  visibleInList: boolean
  offeredInPicker: boolean
  canRename: boolean
  canDelete: boolean
  canEditPermissions: boolean
  isFullyReadonly: boolean
  kind: "admin" | "user" | "system" | "custom"
}

function namesEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

export function isSuperAdminRole(role: Pick<TenantRoleRef, "name">): boolean {
  return namesEqual(role.name, SYSTEM_ROLE_NAMES.SuperAdmin)
}

export function isSystemAdminRole(
  role: Pick<TenantRoleRef, "name" | "isSystemRole">,
): boolean {
  return role.isSystemRole && namesEqual(role.name, SYSTEM_ROLE_NAMES.Admin)
}

export function isSystemUserRole(
  role: Pick<TenantRoleRef, "name" | "isSystemRole">,
): boolean {
  return role.isSystemRole && namesEqual(role.name, SYSTEM_ROLE_NAMES.User)
}

export function getRoleEditorPolicy(
  role: Pick<TenantRoleRef, "name" | "isSystemRole">,
): RoleEditorPolicy {
  if (isSuperAdminRole(role)) {
    return {
      visibleInList: false,
      offeredInPicker: false,
      canRename: false,
      canDelete: false,
      canEditPermissions: false,
      isFullyReadonly: true,
      kind: "admin",
    }
  }

  if (isSystemAdminRole(role)) {
    return {
      visibleInList: true,
      offeredInPicker: true,
      canRename: false,
      canDelete: false,
      canEditPermissions: false,
      isFullyReadonly: true,
      kind: "admin",
    }
  }

  if (isSystemUserRole(role)) {
    return {
      visibleInList: true,
      offeredInPicker: true,
      canRename: false,
      canDelete: false,
      canEditPermissions: true,
      isFullyReadonly: false,
      kind: "user",
    }
  }

  if (role.isSystemRole) {
    return {
      visibleInList: true,
      offeredInPicker: true,
      canRename: false,
      canDelete: false,
      canEditPermissions: true,
      isFullyReadonly: false,
      kind: "system",
    }
  }

  return {
    visibleInList: true,
    offeredInPicker: true,
    canRename: true,
    canDelete: true,
    canEditPermissions: true,
    isFullyReadonly: false,
    kind: "custom",
  }
}

export function listVisibleRoles<T extends Pick<TenantRoleRef, "name" | "isSystemRole">>(
  roles: readonly T[],
): T[] {
  return roles.filter((role) => getRoleEditorPolicy(role).visibleInList)
}

export function listAssignableRoles<T extends Pick<TenantRoleRef, "name" | "isSystemRole">>(
  roles: readonly T[],
): T[] {
  return roles.filter((role) => getRoleEditorPolicy(role).offeredInPicker)
}
