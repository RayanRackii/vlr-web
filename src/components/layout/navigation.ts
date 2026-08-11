import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  ClipboardPen,
  FormInput,
  LayoutDashboard,
  MenuSquare,
  Shield,
  Wrench,
} from "lucide-react"

import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { getCurrentUser } from "@/features/users/services/usersService"

export type AppNavigationChildItem = {
  labelKey:
    | "nav.assetsInventory"
    | "nav.assetsCategories"
    | "nav.pmocPlans"
    | "nav.pmocNew"
    | "nav.adminTenants"
    | "nav.adminUsers"
  to: string
}

export type AppNavigationItem = {
  labelKey:
    | "nav.dashboard"
    | "nav.assets"
    | "nav.pmoc"
    | "nav.workOrders"
    | "nav.registrationFields"
    | "nav.moduleMenu"
    | "nav.schedule"
    | "nav.reservations"
    | "nav.admin"
  to: string
  icon: LucideIcon
  children?: readonly AppNavigationChildItem[]
  /** Canonical tenant module keys that unlock this item. Empty = always visible. */
  modules?: readonly string[]
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

const overviewItem: AppNavigationItem = {
  labelKey: "nav.dashboard",
  to: "/dashboard",
  icon: LayoutDashboard,
}

const peoplePortalItems: readonly AppNavigationItem[] = [
  {
    labelKey: "nav.registrationFields",
    to: "/configuracoes/cadastro",
    icon: FormInput,
    modules: ["rentals"],
  },
  {
    labelKey: "nav.moduleMenu",
    to: "/configuracoes/menu",
    icon: MenuSquare,
    modules: ["rentals"],
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
      },
      {
        labelKey: "nav.assetsCategories",
        to: "/ativos/categorias",
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
      },
      {
        labelKey: "nav.pmocNew",
        to: "/pmoc/novo",
      },
    ],
  },
  {
    labelKey: "nav.workOrders",
    to: "/os",
    icon: ClipboardPen,
    modules: ["os"],
  },
  {
    labelKey: "nav.schedule",
    to: "/configuracoes/agenda",
    icon: CalendarClock,
    modules: ["rentals"],
  },
  {
    labelKey: "nav.reservations",
    to: "/configuracoes/reservas",
    icon: CalendarCheck,
    modules: ["rentals"],
  },
]

/** Flat catalog used for title resolution and module filtering helpers. */
export const appNavigationItems: readonly AppNavigationItem[] = [
  overviewItem,
  ...peoplePortalItems,
  ...operationsItems,
]

function filterByActiveModules(
  items: readonly AppNavigationItem[],
  activeModules: readonly string[],
): AppNavigationItem[] {
  const enabled = new Set(
    activeModules.map((module) => module.trim().toLowerCase()),
  )

  return items.filter((item) => {
    if (!item.modules || item.modules.length === 0) {
      return true
    }

    return item.modules.some((module) => enabled.has(module))
  })
}

function buildProductSections(
  activeModules: readonly string[],
): AppNavigationSection[] {
  const sections: AppNavigationSection[] = [
    {
      titleKey: "nav.sections.overview",
      items: [overviewItem],
    },
  ]

  const people = filterByActiveModules(peoplePortalItems, activeModules)
  if (people.length > 0) {
    sections.push({
      titleKey: "nav.sections.peoplePortal",
      items: people,
    })
  }

  const operations = filterByActiveModules(operationsItems, activeModules)
  if (operations.length > 0) {
    sections.push({
      titleKey: "nav.sections.operations",
      items: operations,
    })
  }

  return sections
}

export function useAppNavigationSections(): readonly AppNavigationSection[] {
  const isPlatformAdmin = useIsPlatformAdmin()
  const { isInTenantEnvironment } = usePlatformTenantSession()
  const [activeModules, setActiveModules] = useState<string[] | null>(null)

  const needsProductNav = !isPlatformAdmin || isInTenantEnvironment

  useEffect(() => {
    if (!needsProductNav) {
      setActiveModules(null)
      return
    }

    let cancelled = false

    void getCurrentUser()
      .then((profile) => {
        if (!cancelled) {
          setActiveModules(profile.activeModules ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveModules([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [needsProductNav, isInTenantEnvironment])

  return useMemo(() => {
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

    if (activeModules === null) {
      return [
        {
          titleKey: "nav.sections.overview",
          items: [overviewItem],
        },
      ]
    }

    return buildProductSections(activeModules)
  }, [activeModules, isInTenantEnvironment, isPlatformAdmin])
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

  if (pathname.startsWith("/os/")) {
    return "nav.workOrders"
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
