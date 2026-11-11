import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import {
  MenuSquare,
} from "lucide-react"

import { filterNavigationTabs, type NavigationTab } from "@/components/layout/navigationTabs"
import { matchModuleIntro, type ModuleIntro, type ModuleIntroKey } from "./navigationIntros"
import { matchNavigationPath } from "./navigationMatching"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { agendaManifest } from "@/features/agenda/manifest"
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
    | "nav.catalogCustomerGroups"
    | "nav.catalogOrders"
    | "nav.agendasOverview"
    | "nav.agendasResources"
    | "nav.agendasProduct"
    | "nav.catalogProductAgenda"
    | "nav.catalogResourceAgenda"
    | "nav.catalogRequests"
    | "nav.catalogNotifications"
    | "nav.catalogSettings"
    | "nav.taxonomy"
  to: string
  icon?: LucideIcon
  /** Internal destinations, never sidebar children. */
  tabs?: readonly NavigationTab[]
  /** Canonical tenant module keys that unlock this child. Empty/absent = inherits the parent. */
  modules?: readonly string[]
  /** Every key is required, unless `anyOf` is set. An entry with none is hidden. */
  permission?: string
  permissions?: readonly string[]
  /** When true, any one declared key shows the item. */
  anyOf?: boolean
}

export type AppNavigationItem = {
  introKey?: ModuleIntroKey
  labelKey:
    | "nav.agenda"
    | "nav.agendas"
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
    | "nav.catalogProducts"
    | "nav.catalogOrders"
    | "nav.agendasOverview"
    | "nav.agendasResources"
    | "nav.agendasProduct"
    | "nav.catalogProductAgenda"
    | "nav.catalogResourceAgenda"
    | "nav.catalogRequests"
    | "nav.catalogSettings"
    | "nav.catalogCustomerGroups"
    | "nav.catalogNotifications"
  to: string
  tabs?: readonly NavigationTab[]
  icon: LucideIcon
  children?: readonly AppNavigationChildItem[]
  /** Canonical tenant module keys that unlock this item. Empty = always visible. */
  modules?: readonly string[]
  /** Every key is required, unless `anyOf` is set. An entry with none is hidden. */
  permission?: string
  permissions?: readonly string[]
  /** When true, any one declared key shows the item. */
  anyOf?: boolean
}

export type AppNavigationSectionTitleKey =
  | "nav.sections.overview"
  | "nav.sections.peoplePortal"
  | "nav.sections.bookings"
  | "nav.sections.maintenance"
  | "nav.sections.sales"
  | "nav.sections.platform"
  | "nav.sections.operations"
  | "nav.sections.registration"
  | "nav.sections.customers"
  | "nav.sections.portal"
  | "nav.sections.settings"

export type AppNavigationSection = {
  introKey?: ModuleIntroKey
  defaultCollapsed?: boolean
  standalone?: boolean
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
    labelKey: "nav.moduleMenu",
    to: "/configuracoes/menu",
    icon: MenuSquare,
    modules: ["rentals", "catalog"],
    permission: "core.module_menu.read",
  },
  ...taxonomyManifest.navigationItems,
  ...notificationsManifest.navigationItems,
]

const maintenanceItems: readonly AppNavigationItem[] = [
  ...assetsManifest.navigationItems,
  ...pmocManifest.navigationItems,
  ...workOrdersManifest.navigationItems,
]

const bookingsItems: readonly AppNavigationItem[] = rentalsManifest.navigationItems
const salesItems: readonly AppNavigationItem[] = catalogManifest.navigationItems.flatMap(
  (item) => item.children.map((child) => ({ ...child, icon: child.icon ?? item.icon, modules: child.modules ?? item.modules })),
)

/** Flat catalog used for title resolution and module filtering helpers. */
export const appNavigationItems: readonly AppNavigationItem[] = [
  ...agendaManifest.navigationItems,
  overviewItem,
  ...bookingsItems,
  ...maintenanceItems,
  ...salesItems,
  ...peoplePortalItems,
]

const legacyNavigationSections: readonly AppNavigationSection[] = [
  { introKey: "overview", titleKey: "nav.sections.overview", items: [overviewItem] },
  { introKey: "bookings", titleKey: "nav.sections.bookings", items: bookingsItems },
  { introKey: "maintenance", titleKey: "nav.sections.maintenance", items: maintenanceItems },
  { introKey: "sales", titleKey: "nav.sections.sales", items: salesItems },
  { introKey: "peoplePortal", titleKey: "nav.sections.peoplePortal", items: peoplePortalItems },
]

// Reuse manifest entries so module, permission and internal-tab access stay intact.
function navigationItemsAt(...paths: string[]): AppNavigationItem[] {
  return paths.flatMap((path) => appNavigationItems.filter((item) => item.to === path))
}

const productNavigationSections: readonly AppNavigationSection[] = [
  { titleKey: "nav.sections.overview", standalone: true, items: [overviewItem] },
  { titleKey: "nav.sections.operations", items: navigationItemsAt(
    "/agendas", "/catalogo/pedidos",
    "/catalogo/solicitacoes", "/configuracoes/reservas", "/os", "/pmoc",
  ) },
  { titleKey: "nav.sections.registration", items: navigationItemsAt(
    "/configuracoes/recursos", "/catalogo/produtos", "/configuracoes/categorias-tags",
    "/ativos", "/configuracoes/cadastro",
  ) },
  { titleKey: "nav.sections.customers", items: navigationItemsAt("/pessoas-e-acesso", "/catalogo/grupos") },
  { titleKey: "nav.sections.portal", items: navigationItemsAt("/configuracoes/menu", "/configuracoes/layout") },
  { titleKey: "nav.sections.settings", defaultCollapsed: true, items: navigationItemsAt(
    "/configuracoes/agenda", "/catalogo/configuracoes", "/configuracoes/notificacoes",
  ) },
]

const platformNavigationSection: AppNavigationSection = {
  introKey: "platform",
  titleKey: "nav.sections.platform",
  items: adminManifest.navigationItems,
}

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
  entry: { permission?: string; permissions?: readonly string[]; anyOf?: boolean },
  granted: readonly string[],
): boolean {
  const required = declaredPermissionKeys(entry)
  if (required.length === 0) {
    return false
  }

  const holds = (key: string) => hasPermission(granted, key)
  return entry.anyOf ? required.some(holds) : required.every(holds)
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

      const children = item.children.flatMap((child) => {
        if (!moduleIsEnabled(child.modules, activeModules)) {
          return []
        }
        if (child.tabs) {
          const tabs = filterNavigationTabs(child.tabs, activeModules, permissions)
          return tabs[0] ? [{ ...child, tabs, to: tabs[0].to }] : []
        }
        return hasDeclaredAccess(child, permissions) ? [child] : []
      })

      if (children.length === 0) {
        return []
      }

      return [{ ...item, children }]
    }

    if (item.tabs) {
      const tabs = filterNavigationTabs(item.tabs, activeModules, permissions)
      return tabs[0] ? [{ ...item, tabs, to: tabs[0].to }] : []
    }

    if (!hasDeclaredAccess(item, permissions)) {
      return []
    }

    return [item]
  })
}

function sectionsFrom(
  source: readonly AppNavigationSection[],
  activeModules: readonly string[],
  permissions: readonly string[],
): AppNavigationSection[] {
  return source.flatMap((section) => {
    const items = filterNavigationItemsByAccess(section.items, activeModules, permissions)
    return items.length ? [{ ...section, items }] : []
  })
}

export function buildProductSections(
  activeModules: readonly string[],
  permissions: readonly string[],
): AppNavigationSection[] {
  return sectionsFrom(productNavigationSections, activeModules, permissions)
}

/** First route the user may open after a dashboard deny, in the previous landing order. */
export function firstPermittedProductPath(
  activeModules: readonly string[],
  permissions: readonly string[],
): string | null {
  for (const section of sectionsFrom(legacyNavigationSections, activeModules, permissions)) {
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

export function useAppNavigationSections(mode: "shell" | "module-intros" = "shell"): AppNavigationState {
  const { isPlatformAdmin, isInTenantEnvironment } = usePlatformTenantSession()
  const { activeModules, permissions, isLoading } = usePermissions()

  const needsProductNav = !isPlatformAdmin || isInTenantEnvironment

  const sections = useMemo<readonly AppNavigationSection[]>(() => {
    if (isPlatformAdmin && !isInTenantEnvironment) {
      return [
        {
          standalone: mode === "shell",
          introKey: mode === "module-intros" ? "overview" : undefined,
          titleKey: "nav.sections.overview",
          items: [overviewItem],
        },
        platformNavigationSection,
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

    if (mode === "module-intros") {
      return legacyNavigationSections.flatMap((section) => {
        const items = filterNavigationItemsByAccess(section.items, activeModules, permissions)
        return items.length ? [{ ...section, items }] : []
      })
    }
    return buildProductSections(activeModules, permissions)
  }, [
    mode,
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
  | ModuleIntro["titleKey"]
  | "nav.pmocTemplatePreview"
  | "nav.pmocPlanDetail"
  | NavigationTab["labelKey"]
  | "account.profile"
  | "nav.rentalsResourceWizard"
  | "nav.catalogProductWizard"
  | "app.name" {
  const intro = matchModuleIntro([...legacyNavigationSections, platformNavigationSection], pathname)
  if (intro) return intro.titleKey

  if (pathname === "/perfil") {
    return "account.profile"
  }

  if (/^\/configuracoes\/recursos\/[^/]+\/(assistente|passos)\/?$/.test(pathname)) {
    return "nav.rentalsResourceWizard"
  }

  if (/^\/catalogo\/produtos\/[^/]+\/(assistente|passos)\/?$/.test(pathname)) {
    return "nav.catalogProductWizard"
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

  // Keep the custom-plan page title at its original URL.
  if (pathname === "/pmoc/novo") return "nav.pmocNew"

  const match = matchNavigationPath(appNavigationItems, pathname)
  if (match) return match.tab?.labelKey ?? match.child?.labelKey ?? match.item.labelKey

  // Platform admin destinations are outside the app navigation catalog.
  if (pathname === "/admin/asset-families" || pathname.startsWith("/admin/asset-families/")) {
    return "nav.adminAssetFamilies"
  }
  if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
    return "nav.adminUsers"
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "nav.adminTenants"

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

export { getEmailInitials } from "@/lib/emailInitials"
