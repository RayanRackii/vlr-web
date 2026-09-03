import { ClipboardList, ShoppingBag } from "lucide-react"
import type { TFunction } from "i18next"

import type { CustomerNavItem } from "@/features/tenantPortal/components/CustomerSidebar"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  menuItemAgendaPath,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import { iconForModule } from "@/features/tenantPortal/components/CustomerSidebar"

const CATALOG_MODULE_ALIASES = new Set([
  "catalog",
  "catalogo",
  "catálogo",
  "orders",
  "pedidos",
])

export function isCatalogModuleName(moduleName: string): boolean {
  return CATALOG_MODULE_ALIASES.has(moduleName.trim().toLowerCase())
}

/** Canonical platform module key (`rentals`, `catalog`, …). */
export function toCanonicalModuleName(moduleName: string): string {
  const normalized = moduleName.trim().toLowerCase()
  if (isCatalogModuleName(normalized)) {
    return "catalog"
  }
  return normalized
}

export function isCustomerNavModule(moduleName: string): boolean {
  const canonical = toCanonicalModuleName(moduleName)
  return canonical === "rentals" || canonical === "catalog"
}

export function getVisiblePortalMenuItems(
  items: readonly ModuleMenuItem[],
  activeModules: readonly string[],
): ModuleMenuItem[] {
  const active = new Set(
    activeModules.map((moduleName) => toCanonicalModuleName(moduleName)),
  )

  return items
    .filter(
      (item) =>
        item.isActive && active.has(toCanonicalModuleName(item.moduleName)),
    )
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }
      return left.label.localeCompare(right.label, undefined, {
        sensitivity: "base",
      })
    })
}

export function suggestPortalMenuLabel({
  moduleName,
  rentalAssetName,
  t,
}: {
  moduleName: string
  rentalAssetName?: string | null
  t: TFunction
}): string {
  if (isCatalogModuleName(moduleName)) {
    return t("tenantPortal.catalog.navCatalog")
  }

  if (toCanonicalModuleName(moduleName) === "rentals") {
    const name = rentalAssetName?.trim()
    if (name) {
      return t("admin.moduleMenu.suggestedLabelRentalsAsset", { name })
    }
    return t("admin.moduleMenu.suggestedLabelRentals")
  }

  return ""
}

export function buildCustomerNavItems(
  subdomain: string,
  menu: readonly ModuleMenuItem[],
  t: TFunction,
): CustomerNavItem[] {
  const items: CustomerNavItem[] = []
  let catalogAdded = false

  for (const item of menu) {
    if (isCatalogModuleName(item.moduleName)) {
      if (catalogAdded) {
        continue
      }

      items.push({
        id: `${item.id}-catalog`,
        label: t("tenantPortal.catalog.navCatalog"),
        to: tenantPortalPath(subdomain, "catalogo"),
        icon: ShoppingBag,
      })
      items.push({
        id: `${item.id}-orders`,
        label: t("tenantPortal.catalog.navOrders"),
        to: tenantPortalPath(subdomain, "pedidos"),
        icon: ClipboardList,
      })
      catalogAdded = true
      continue
    }

    if (item.moduleName.toLowerCase() === "rentals") {
      items.push({
        id: item.id,
        label: item.label,
        to: menuItemAgendaPath(subdomain, item.id),
        icon: iconForModule(item.moduleName),
      })
    }
  }

  return items
}
