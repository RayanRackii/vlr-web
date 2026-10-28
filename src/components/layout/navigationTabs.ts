import { hasPermission } from "@/features/users/permissions/hasPermission"
import type { LucideIcon } from "lucide-react"

export type NavigationTab = {
  labelKey:
    | "nav.assetsInventory"
    | "nav.assetsCategories"
    | "nav.reservations"
    | "nav.bookingPolicy"
    | "nav.pmocLibrary"
    | "nav.pmocCustom"
    | "nav.peopleAccess"
    | "nav.registrationFields"
  to: string
  permission: string
  icon?: LucideIcon
  modules?: readonly string[]
}

export function filterNavigationTabs(
  tabs: readonly NavigationTab[],
  activeModules: readonly string[],
  permissions: readonly string[],
): NavigationTab[] {
  const enabled = new Set(activeModules.map((module) => module.trim().toLowerCase()))
  return tabs.filter((tab) =>
    (!tab.modules?.length || tab.modules.some((module) => enabled.has(module))) &&
    hasPermission(permissions, tab.permission),
  )
}
