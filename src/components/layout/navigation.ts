import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Boxes,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  ClipboardPen,
  FormInput,
  LayoutDashboard,
  Map,
  MenuSquare,
  Package,
  Shield,
  Users,
  Wrench,
} from "lucide-react"

import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { hasPermission } from "@/features/users/permissions/hasPermission"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

export type AppNavigationChildItem = {
  labelKey:
    | "nav.assetsInventory"
    | "nav.assetsCategories"
    | "nav.pmocPlans"
    | "nav.pmocNew"
    | "nav.adminTenants"
    | "nav.adminUsers"
    | "nav.catalogProducts"
    | "nav.catalogOrders"
    | "nav.catalogNotifications"
  to: string
  permission?: string
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
    | "nav.rentalsResources"
    | "nav.admin"
    | "nav.catalog"
  to: string
  icon: LucideIcon
  children?: readonly AppNavigationChildItem[]
  /** Canonical tenant module keys that unlock this item. Empty = always visible. */
  modules?: readonly string[]
  permission?: string
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

const overviewItem: AppNavigationItem = {
  labelKey: "nav.dashboard",
  to: "/dashboard",
  icon: LayoutDashboard,
  permission: "core.dashboard.read",
}

const peoplePortalItems: readonly AppNavigationItem[] = [
  {
    labelKey: "nav.peopleAccess",
    to: "/pessoas-e-acesso",
    icon: Users,
    permission: "core.users.read",
  },
  {
    labelKey: "nav.registrationFields",
    to: "/configuracoes/cadastro",
    icon: FormInput,
    modules: ["rentals"],
    permission: "core.registration_fields.read",
  },
  {
    labelKey: "nav.moduleMenu",
    to: "/configuracoes/menu",
    icon: MenuSquare,
    modules: ["rentals"],
    permission: "core.module_menu.read",
  },
]

const operationsItems: readonly AppNavigationItem[] = [
  {
    labelKey: "nav.assets",
    to: "/ativos",
    icon: Wrench,
    modules: ["inventory"],
    children: [
      {
        labelKey: "nav.assetsInventory",
        to: "/ativos",
        permission: "inventory.assets.read",
      },
      {
        labelKey: "nav.assetsCategories",
        to: "/ativos/categorias",
        permission: "inventory.categories.read",
      },
    ],
  },
  {
    labelKey: "nav.pmoc",
    to: "/pmoc",
    icon: ClipboardList,
    modules: ["pmoc"],
    children: [
      {
        labelKey: "nav.pmocPlans",
        to: "/pmoc",
        permission: "pmoc.plans.read",
      },
      {
        labelKey: "nav.pmocNew",
        to: "/pmoc/novo",
        permission: "pmoc.plans.write",
      },
    ],
  },
  {
    labelKey: "nav.workOrders",
    to: "/os",
    icon: ClipboardPen,
    modules: ["os"],
    permission: "os.work_orders.read",
  },
  {
    labelKey: "nav.rentalsResources",
    to: "/configuracoes/recursos",
    icon: Boxes,
    modules: ["rentals"],
    permission: "rentals.assets.read",
  },
  {
    labelKey: "nav.schedule",
    to: "/configuracoes/agenda",
    icon: CalendarClock,
    modules: ["rentals"],
    permission: "rentals.schedule.read",
  },
  {
    labelKey: "nav.layout",
    to: "/configuracoes/layout",
    icon: Map,
    modules: ["rentals"],
    permission: "rentals.layouts.read",
  },
  {
    labelKey: "nav.reservations",
    to: "/configuracoes/reservas",
    icon: CalendarCheck,
    modules: ["rentals"],
    permission: "rentals.reservations.read",
  },
  {
    labelKey: "nav.catalog",
    to: "/catalogo/produtos",
    icon: Package,
    modules: ["catalog"],
    children: [
      {
        labelKey: "nav.catalogProducts",
        to: "/catalogo/produtos",
        permission: "catalog.products.read",
      },
      {
        labelKey: "nav.catalogOrders",
        to: "/catalogo/pedidos",
        permission: "catalog.orders.read",
      },
      {
        labelKey: "nav.catalogNotifications",
        to: "/catalogo/notificacoes",
        permission: "catalog.notifications.read",
      },
    ],
  },
]

/** Flat catalog used for title resolution and module filtering helpers. */
export const appNavigationItems: readonly AppNavigationItem[] = [
  overviewItem,
  ...peoplePortalItems,
  ...operationsItems,
]

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
      const children = item.children.filter((child) => {
        if (!child.permission) {
          return true
        }

        return hasPermission(permissions, child.permission)
      })

      if (children.length === 0) {
        return []
      }

      return [{ ...item, children }]
    }

    if (item.permission && !hasPermission(permissions, item.permission)) {
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

export function useAppNavigationSections(): AppNavigationState {
  const isPlatformAdmin = useIsPlatformAdmin()
  const { isInTenantEnvironment } = usePlatformTenantSession()
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
          items: [
            {
              labelKey: "nav.admin",
              to: "/admin/dashboard",
              icon: Shield,
              children: [
                {
                  labelKey: "nav.adminTenants",
                  to: "/admin/dashboard",
                },
                {
                  labelKey: "nav.adminUsers",
                  to: "/admin/users",
                },
              ],
            },
          ],
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
  | "app.name" {
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
