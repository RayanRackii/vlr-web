import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  Package,
  ShoppingBag,
  Tent,
  Wrench,
} from "lucide-react"

import {
  MODULE_KEYS,
  type ModuleKey,
} from "@/features/admin/schemas/adminTenantSchemas"
import { toCanonicalModuleName } from "@/features/catalog/customerNav"

export type ModuleCatalogCategory = "customer" | "operations"

export type ModuleCatalogEntry = {
  key: ModuleKey
  category: ModuleCatalogCategory
  icon: LucideIcon
  nameKey: `admin.modules.${ModuleKey}`
  descriptionKey: `admin.moduleMenu.exploreDescriptions.${ModuleKey}`
}

const CATEGORY_BY_KEY: Record<ModuleKey, ModuleCatalogCategory> = {
  Catalog: "customer",
  Rentals: "customer",
  PMOC: "operations",
  Inventory: "operations",
  OS: "operations",
}

const ICON_BY_KEY: Record<ModuleKey, LucideIcon> = {
  Inventory: Package,
  PMOC: ClipboardList,
  OS: Wrench,
  Rentals: Tent,
  Catalog: ShoppingBag,
}

/** Presentation metadata for every platform module in `MODULE_KEYS`. */
export const MODULE_CATALOG: readonly ModuleCatalogEntry[] = MODULE_KEYS.map(
  (key) => ({
    key,
    category: CATEGORY_BY_KEY[key],
    icon: ICON_BY_KEY[key],
    nameKey: `admin.modules.${key}`,
    descriptionKey: `admin.moduleMenu.exploreDescriptions.${key}`,
  }),
)

export function isModuleCatalogEntryActive(
  key: ModuleKey,
  activeModules: readonly string[],
): boolean {
  const active = new Set(
    activeModules.map((name) => toCanonicalModuleName(name)),
  )
  return active.has(toCanonicalModuleName(key))
}

export function areAllCatalogModulesActive(
  activeModules: readonly string[],
): boolean {
  return MODULE_KEYS.every((key) =>
    isModuleCatalogEntryActive(key, activeModules),
  )
}

export function modulesByCategory(
  category: ModuleCatalogCategory,
): readonly ModuleCatalogEntry[] {
  return MODULE_CATALOG.filter((entry) => entry.category === category)
}
