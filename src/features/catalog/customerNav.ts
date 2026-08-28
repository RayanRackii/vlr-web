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
