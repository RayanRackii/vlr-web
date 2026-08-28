export type PermissionCatalogItem = {
  key: string
  name: string
  description?: string | null
  moduleKey?: string | null
  resource: string
}

export type PermissionResourceGroup = {
  resource: string
  items: PermissionCatalogItem[]
}

export type PermissionModuleGroup = {
  moduleKey: string | null
  moduleInactive: boolean
  resources: PermissionResourceGroup[]
}

export const MODULE_ORDER = [
  "core",
  "inventory",
  "pmoc",
  "os",
  "rentals",
  "catalog",
] as const

export function normalizeModuleKey(
  moduleKey: string | null | undefined,
): string | null {
  if (moduleKey == null || moduleKey.trim().length === 0) {
    return null
  }

  const normalized = moduleKey.trim().toLowerCase()
  return normalized === "core" ? null : normalized
}

export function isModuleActiveForPermissions(
  moduleKey: string | null | undefined,
  activeModules: readonly string[],
): boolean {
  const normalized = normalizeModuleKey(moduleKey)

  if (normalized === null) {
    return true
  }

  const enabled = new Set(
    activeModules.map((module) => module.trim().toLowerCase()),
  )

  return enabled.has(normalized)
}

function moduleSortKey(moduleKey: string | null): string {
  return moduleKey ?? "core"
}

export function groupPermissionsByModule(
  catalog: readonly PermissionCatalogItem[],
  activeModules: readonly string[],
): PermissionModuleGroup[] {
  const byModule = new Map<string, PermissionCatalogItem[]>()

  for (const item of catalog) {
    const key = moduleSortKey(normalizeModuleKey(item.moduleKey))
    const bucket = byModule.get(key)

    if (bucket) {
      bucket.push(item)
    } else {
      byModule.set(key, [item])
    }
  }

  const orderedKeys = [
    ...MODULE_ORDER.filter((key) => byModule.has(key)),
    ...[...byModule.keys()]
      .filter(
        (key) =>
          !MODULE_ORDER.includes(key as (typeof MODULE_ORDER)[number]),
      )
      .sort((left, right) => left.localeCompare(right)),
  ]

  return orderedKeys.map((key) => {
    const items = byModule.get(key) ?? []
    const moduleKey = key === "core" ? null : key
    const byResource = new Map<string, PermissionCatalogItem[]>()

    for (const item of items) {
      const resource = item.resource.trim() || item.key
      const bucket = byResource.get(resource)

      if (bucket) {
        bucket.push(item)
      } else {
        byResource.set(resource, [item])
      }
    }

    const resources: PermissionResourceGroup[] = [...byResource.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resource, resourceItems]) => ({
        resource,
        items: [...resourceItems].sort((left, right) =>
          left.key.localeCompare(right.key),
        ),
      }))

    return {
      moduleKey,
      moduleInactive: !isModuleActiveForPermissions(moduleKey, activeModules),
      resources,
    }
  })
}

export type PermissionRouteAccess = "loading" | "allow" | "deny"

export function resolvePermissionRouteAccess(options: {
  isLoading: boolean
  hasPermission: boolean
  isPlatformAdminOutsideTenant: boolean
  permission: string
}): PermissionRouteAccess {
  if (options.isLoading) {
    return "loading"
  }

  if (
    options.isPlatformAdminOutsideTenant &&
    options.permission === "core.dashboard.read"
  ) {
    return "allow"
  }

  return options.hasPermission ? "allow" : "deny"
}
