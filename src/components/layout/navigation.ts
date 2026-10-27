import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import {
  FormInput,
  MenuSquare,
} from "lucide-react"

import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { adminManifest } from "@/features/admin/manifest"
import { assetsManifest } from "@/features/assets/manifest"
import { catalogManifest } from "@/features/catalog/manifest"
import { dashboardManifest } from "@/features/dashboard/manifest"
import { notificationsManifest } from "@/features/notifications/manifest"
import { pmocManifest } from "@/features/pmoc/manifest"
import { rentalsManifest } from "@/features/rentals/manifest"
import { taxonomyManifest } from "@/features/taxonomy/manifest"
import { usersManifest } from "@/features/users/manifest"
import { workOrdersManifest } from "@/features/workOrders/manifest"
import { hasPermission } from "@/features/users/permissions/hasPermission"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export { RENTAL_RESOURCES_PERMISSIONS } from "@/features/rentals/manifest"

export type AppNavigationChildItem = {
  labelKey:
    | "nav.assetsInventory"
    | "nav.assetsCategories"
    | "nav.pmocPlans"
    | "nav.pmocLibrary"
    | "nav.pmocNew"
    | "nav.adminTenants"
    | "nav.adminUsers"
    | "nav.adminAssetFamilies"
    | "nav.catalogProducts"
    | "nav.catalogOrders"
    | "nav.catalogNotifications"
    | "nav.catalogSettings"
    | "nav.taxonomy"
  to: string
  /** Every key is required. An entry with none is hidden. */
  permission?: string
  permissions?: readonly string[]
}

export type AppNavigationItem = {
  labelKey:
    | "nav.dashboard"
    | "nav.peopleAccess"
    | "nav.assets"
    | "nav.pmoc"
    | "nav.workOrders"
    | "nav.registrationFields"
    | "nav.moduleMenu"
    | "nav.schedule"
    | "nav.layout"
    | "nav.reservations"
    | "nav.bookingPolicy"
    | "nav.rentalsResources"
    | "nav.admin"
    | "nav.catalog"
    | "nav.notifications"
    | "nav.taxonomy"
  to: string
  icon: LucideIcon
  children?: readonly AppNavigationChildItem[]
  /** Canonical tenant module keys that unlock this item. Empty = always visible. */
  modules?: readonly string[]
  /** Every key is required. An entry with none is hidden. */
  permission?: string
  permissions?: readonly string[]
}

export type AppNavigationSectionTitleKey =
  | "nav.sections.overview"
  | "nav.sections.peoplePortal"
  | "nav.sections.operations"
  | "nav.sections.platform"

export type AppNavigationSection = {
  titleKey: AppNavigationSectionTitleKey
  items: readonly AppNavigationItem[]
}

export type AppNavigationState = {
  sections: readonly AppNavigationSection[]
  isLoading: boolean
}

const overviewItem = dashboardManifest.navigationItems[0]

const peoplePortalItems: readonly AppNavigationItem[] = [
  ...usersManifest.navigationItems,
  {
    labelKey: "nav.registrationFields",
    to: "/configuracoes/cadastro",
    icon: FormInput,
    modules: ["rentals", "catalog"],
    permission: "core.registration_fields.read",
  },
  {
    labelKey: "nav.moduleMenu",
    to: "/configuracoes/menu",
    icon: MenuSquare,
    modules: ["rentals", "catalog"],
    permission: "core.module_menu.read",
  },
  ...taxonomyManifest.navigationItems,
  ...notificationsManifest.navigationItems,
]

const operationsItems: readonly AppNavigationItem[] = [
  ...assetsManifest.navigationItems,
  ...pmocManifest.navigationItems,
  ...workOrdersManifest.navigationItems,
  ...rentalsManifest.navigationItems,
  ...catalogManifest.navigationItems,
]

/** Flat catalog used for title resolution and module filtering helpers. */
export const appNavigationItems: readonly AppNavigationItem[] = [
  overviewItem,
  ...peoplePortalItems,
  ...operationsItems,
]

export function declaredPermissionKeys(entry: {
  permission?: string
  permissions?: readonly string[]
}): readonly string[] {
  const keys: string[] = []
  if (entry.permission) {
    keys.push(entry.permission)
  }

  for (const key of entry.permissions ?? []) {
    if (!keys.includes(key)) {
      keys.push(key)
    }
  }

  return keys
}

function hasDeclaredAccess(
  entry: { permission?: string; permissions?: readonly string[] },
  granted: readonly string[],
): boolean {
  const required = declaredPermissionKeys(entry)
  if (required.length === 0) {
    return false
  }

  return required.every((key) => hasPermission(granted, key))
}

function moduleIsEnabled(
  modules: readonly string[] | undefined,
  activeModules: readonly string[],
): boolean {
  if (!modules || modules.length === 0) {
    return true
  }

  const enabled = new Set(
    activeModules.map((module) => module.trim().toLowerCase()),
  )

  return modules.some((module) => enabled.has(module))
}

export function filterNavigationItemsByAccess(
  items: readonly AppNavigationItem[],
  activeModules: readonly string[],
  permissions: readonly string[],
): AppNavigationItem[] {
  return items.flatMap((item) => {
    if (!moduleIsEnabled(item.modules, activeModules)) {
      return []
    }

    if (item.children && item.children.length > 0) {
      if (
        declaredPermissionKeys(item).length > 0 &&
        !hasDeclaredAccess(item, permissions)
      ) {
        return []
      }

      const children = item.children.filter((child) =>
        hasDeclaredAccess(child, permissions),
      )

      if (children.length === 0) {
        return []
      }

      return [{ ...item, children }]
    }

    if (!hasDeclaredAccess(item, permissions)) {
      return []
    }

    return [item]
  })
}

function buildProductSections(
  activeModules: readonly string[],
  permissions: readonly string[],
): AppNavigationSection[] {
  const sections: AppNavigationSection[] = []

  const overview = filterNavigationItemsByAccess(
    [overviewItem],
    activeModules,
    permissions,
  )
  if (overview.length > 0) {
    sections.push({
      titleKey: "nav.sections.overview",
      items: overview,
    })
  }

  const people = filterNavigationItemsByAccess(
    peoplePortalItems,
    activeModules,
    permissions,
  )
  if (people.length > 0) {
    sections.push({
      titleKey: "nav.sections.peoplePortal",
      items: people,
    })
  }

  const operations = filterNavigationItemsByAccess(
    operationsItems,
    activeModules,
    permissions,
  )
  if (operations.length > 0) {
    sections.push({
      titleKey: "nav.sections.operations",
      items: operations,
    })
  }

  return sections
}

/** First sidebar route the user may open, in product-nav order. */
export function firstPermittedProductPath(
  activeModules: readonly string[],
  permissions: readonly string[],
): string | null {
  for (const section of buildProductSections(activeModules, permissions)) {
    for (const item of section.items) {
      const childPath = item.children?.[0]?.to
      if (childPath) {
        return childPath
      }

      return item.to
    }
  }

  return null
}

export function useAppNavigationSections(): AppNavigationState {
  const { isPlatformAdmin, isInTenantEnvironment } = usePlatformTenantSession()
  const { activeModules, permissions, isLoading } = usePermissions()

  const needsProductNav = !isPlatformAdmin || isInTenantEnvironment

  const sections = useMemo<readonly AppNavigationSection[]>(() => {
    if (isPlatformAdmin && !isInTenantEnvironment) {
      return [
        {
          titleKey: "nav.sections.overview",
          items: [overviewItem],
        },
        {
          titleKey: "nav.sections.platform",
          items: adminManifest.navigationItems,
        },
      ]
    }

    if (isLoading) {
      return [
        {
          titleKey: "nav.sections.overview",
          items: [overviewItem],
        },
      ]
    }

    return buildProductSections(activeModules, permissions)
  }, [
    activeModules,
    isInTenantEnvironment,
    isLoading,
    isPlatformAdmin,
    permissions,
  ])

  return {
    sections,
    isLoading: needsProductNav && isLoading,
  }
}

export function getPageTitleKey(
  pathname: string,
):
  | AppNavigationItem["labelKey"]
  | AppNavigationChildItem["labelKey"]
  | "nav.pmocTemplatePreview"
  | "nav.pmocPlanDetail"
  | "account.profile"
  | "app.name" {
  if (pathname === "/perfil") {
    return "account.profile"
  }

  if (pathname.startsWith("/admin/asset-families")) {
    return "nav.adminAssetFamilies"
  }

  if (pathname.startsWith("/admin/users")) {
    return "nav.adminUsers"
  }

  if (pathname.startsWith("/admin")) {
    return "nav.adminTenants"
  }

  if (pathname.startsWith("/catalogo/notificacoes")) {
    return "nav.catalogNotifications"
  }

  if (pathname.startsWith("/catalogo/pedidos")) {
    return "nav.catalogOrders"
  }

  if (pathname.startsWith("/catalogo")) {
    return "nav.catalogProducts"
  }

  if (pathname.startsWith("/os/")) {
    return "nav.workOrders"
  }

  if (pathname.startsWith("/pessoas-e-acesso")) {
    return "nav.peopleAccess"
  }

  if (pathname.startsWith("/pmoc/biblioteca/")) {
    return "nav.pmocTemplatePreview"
  }

  if (
    /^\/pmoc\/[^/]+$/.test(pathname) &&
    pathname !== "/pmoc/novo" &&
    pathname !== "/pmoc/biblioteca"
  ) {
    return "nav.pmocPlanDetail"
  }

  for (const item of appNavigationItems) {
    if (item.children) {
      const matchedChild = item.children.find((child) => child.to === pathname)

      if (matchedChild) {
        return matchedChild.labelKey
      }
    }

    if (item.to === pathname) {
      return item.labelKey
    }
  }

  return "app.name"
}

export function getUserInitials(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmedName = fullName?.trim() ?? ""
  if (trimmedName.length > 0) {
    const parts = trimmedName.split(/\s+/).filter((part) => part.length > 0)
    const first = parts[0]?.[0]
    const second = parts[1]?.[0]
    if (first && second) {
      return `${first}${second}`.toUpperCase()
    }
    if (first) {
      return first.toUpperCase()
    }
  }

  const trimmedEmail = email?.trim() ?? ""
  if (trimmedEmail.length > 0) {
    return trimmedEmail[0]!.toUpperCase()
  }

  return "?"
}

export function getUserDisplayLabel(
  fullName: string | null | undefined,
  email: string | null | undefined,
  fallback: string,
): string {
  const trimmedName = fullName?.trim() ?? ""
  if (trimmedName.length > 0) {
    return trimmedName
  }

  const trimmedEmail = email?.trim() ?? ""
  if (trimmedEmail.length > 0) {
    return trimmedEmail
  }

  return fallback
}

export function getEmailInitials(email: string | null | undefined): string {
  if (!email) {
    return "?"
  }

  const localPart = email.split("@")[0]?.trim() ?? ""

  if (localPart.length === 0) {
    return "?"
  }

  const segments = localPart
    .split(/[._-]+/)
    .filter((segment) => segment.length > 0)

  if (segments.length >= 2) {
    const first = segments[0]?.[0]
    const second = segments[1]?.[0]

    if (first && second) {
      return `${first}${second}`.toUpperCase()
    }
  }

  return localPart.slice(0, 2).toUpperCase()
}
