export function hasPermission(
  permissions: readonly string[],
  key: string,
): boolean {
  return permissions.includes(key)
}

export function toggleUniqueId(
  ids: readonly string[],
  id: string,
): string[] {
  if (ids.includes(id)) {
    return ids.filter((value) => value !== id)
  }

  return [...ids, id]
}

export function canSubmitRoleIds(ids: readonly string[]): boolean {
  return ids.length >= 1
}

export function formatAssignedRoles(
  roles: readonly { name: string }[],
): string {
  return roles
    .map((role) => role.name.trim())
    .filter((name) => name.length > 0)
    .join(" · ")
}

export function formatMemberAccessLabel(
  fullName: string,
  roles: readonly { name: string }[],
): string {
  const assigned = formatAssignedRoles(roles)

  if (assigned.length === 0) {
    return fullName
  }

  return `${fullName} — ${assigned}`
}
