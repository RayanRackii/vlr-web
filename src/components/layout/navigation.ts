import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  ClipboardPen,
  FormInput,
  LayoutDashboard,
  MenuSquare,
  Shield,
  Wrench,
} from "lucide-react"

import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"

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
    | "nav.admin"
  to: string
  icon: LucideIcon
  children?: readonly AppNavigationChildItem[]
}

export const appNavigationItems: readonly AppNavigationItem[] = [
  {
    labelKey: "nav.dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "nav.assets",
    to: "/ativos",
    icon: Wrench,
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
  },
  {
    labelKey: "nav.registrationFields",
    to: "/configuracoes/cadastro",
    icon: FormInput,
  },
  {
    labelKey: "nav.moduleMenu",
    to: "/configuracoes/menu",
    icon: MenuSquare,
  },
]

export function useAppNavigationItems(): readonly AppNavigationItem[] {
  const isPlatformAdmin = useIsPlatformAdmin()

  if (!isPlatformAdmin) {
    return appNavigationItems
  }

  return [
    ...appNavigationItems,
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
  ]
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
