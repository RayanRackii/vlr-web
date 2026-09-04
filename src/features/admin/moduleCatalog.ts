import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  Package,
  ShoppingBag,
  Tent,
  Wrench,
} from "lucide-react"

import { toCanonicalModuleName } from "@/features/catalog/customerNav"

export type ModuleCatalogCategory = "customer" | "operations"

export type PresentedModule = {
  key: string
  category: ModuleCatalogCategory
  icon: LucideIcon
  nameKey: string
  descriptionKey: string
  exploreDescriptionKey: string
}

const CATEGORY_BY_KEY: Record<string, ModuleCatalogCategory> = {
  catalog: "customer",
  rentals: "customer",
  pmoc: "operations",
  inventory: "operations",
  os: "operations",
}

const ICON_BY_KEY: Record<string, LucideIcon> = {
  inventory: Package,
  pmoc: ClipboardList,
  os: Wrench,
  rentals: Tent,
  catalog: ShoppingBag,
}

const I18N_PASCAL_BY_KEY: Record<string, string> = {
  inventory: "Inventory",
  pmoc: "PMOC",
  os: "OS",
  rentals: "Rentals",
  catalog: "Catalog",
}

export function moduleNameI18nKey(moduleKey: string): string {
  const pascal = I18N_PASCAL_BY_KEY[toCanonicalModuleName(moduleKey)]
  return pascal ? `admin.modules.${pascal}` : "admin.modules.unknown"
}

export function moduleDescriptionI18nKey(moduleKey: string): string {
  const pascal = I18N_PASCAL_BY_KEY[toCanonicalModuleName(moduleKey)]
  return pascal
    ? `admin.modules.${pascal}Description`
    : `${toCanonicalModuleName(moduleKey)}Description`
}

export function moduleExploreDescriptionI18nKey(moduleKey: string): string {
  const pascal = I18N_PASCAL_BY_KEY[toCanonicalModuleName(moduleKey)]
  return pascal
    ? `admin.moduleMenu.exploreDescriptions.${pascal}`
    : toCanonicalModuleName(moduleKey)
}

export function presentCommercialModule(moduleKey: string): PresentedModule {
  const key = toCanonicalModuleName(moduleKey)
  const pascal = I18N_PASCAL_BY_KEY[key]
  return {
    key,
    category: CATEGORY_BY_KEY[key] ?? "operations",
    icon: ICON_BY_KEY[key] ?? Package,
    nameKey: pascal ? `admin.modules.${pascal}` : key,
    descriptionKey: pascal
      ? `admin.modules.${pascal}Description`
      : `${key}Description`,
    exploreDescriptionKey: pascal
      ? `admin.moduleMenu.exploreDescriptions.${pascal}`
      : key,
  }
}

export function isModuleCatalogEntryActive(
  key: string,
  activeModules: readonly string[],
): boolean {
  const active = new Set(
    activeModules.map((name) => toCanonicalModuleName(name)),
  )
  return active.has(toCanonicalModuleName(key))
}

export function areAllCatalogModulesActive(
  activeModules: readonly string[],
  commercialKeys: readonly string[],
): boolean {
  if (commercialKeys.length === 0) {
    return false
  }

  return commercialKeys.every((key) =>
    isModuleCatalogEntryActive(key, activeModules),
  )
}

export function modulesByCategory(
  entries: readonly PresentedModule[],
  category: ModuleCatalogCategory,
): readonly PresentedModule[] {
  return entries.filter((entry) => entry.category === category)
}
