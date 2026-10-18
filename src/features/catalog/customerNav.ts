import { CircleUser, ClipboardList, ListChecks, ShoppingBag } from "lucide-react"
import type { TFunction } from "i18next"

import {
  iconForModule,
  type CustomerNavItem,
} from "@/features/tenantPortal/components/CustomerSidebar"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  menuItemAgendaPath,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import i18n, { supportedLanguages } from "@/lib/i18n"

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

/** B2C portal functionalities supported by customer nav (canonical keys). */
export const PORTAL_CUSTOMER_MODULES = ["rentals", "catalog"] as const

export type PortalCustomerModule = (typeof PORTAL_CUSTOMER_MODULES)[number]

/** Fragment on the rentals agenda that scrolls to the customer's reservations. */
export const CUSTOMER_MY_RESERVATIONS_HASH = "#minhas-reservas"

/**
 * Same-page agenda links keep the current search (date and time).
 * A hash-only target would otherwise drop `?date=` and `?time=`.
 */
export function customerNavHref(
  to: string,
  pathname: string,
  search: string,
): string {
  const hashIndex = to.indexOf("#")
  const path = hashIndex < 0 ? to : to.slice(0, hashIndex)
  const hash = hashIndex < 0 ? "" : to.slice(hashIndex)
  if (path !== pathname || search.length === 0) {
    return to
  }
  return `${path}${search}${hash}`
}

export function isCustomerNavModule(moduleName: string): boolean {
  const canonical = toCanonicalModuleName(moduleName)
  return (PORTAL_CUSTOMER_MODULES as readonly string[]).includes(canonical)
}

function activeModuleSet(activeModules: readonly string[]): Set<string> {
  return new Set(
    activeModules.map((moduleName) => toCanonicalModuleName(moduleName)),
  )
}

/** B2C-supported modules that are active for the tenant. */
export function getEligiblePortalMenuModules(
  activeModules: readonly string[],
): PortalCustomerModule[] {
  const active = activeModuleSet(activeModules)
  return PORTAL_CUSTOMER_MODULES.filter((moduleName) => active.has(moduleName))
}

/** B2C-supported modules that are not active for the tenant (discovery). */
export function getDiscoverablePortalModules(
  activeModules: readonly string[],
): PortalCustomerModule[] {
  const active = activeModuleSet(activeModules)
  return PORTAL_CUSTOMER_MODULES.filter((moduleName) => !active.has(moduleName))
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

function normalizeMenuLabel(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR")
}

/**
 * Stock rentals chrome ("Reservar horário" / "Book a time" / "Reservar horario")
 * follows the active language. Any other label is tenant-entered data and stays
 * as stored — including resource names.
 */
export function localizedCustomerMenuLabel(
  moduleName: string,
  label: string,
  t: TFunction,
): string {
  if (toCanonicalModuleName(moduleName) !== "rentals") {
    return label
  }

  const normalized = normalizeMenuLabel(label)
  const isStockLabel = supportedLanguages.some((language) => {
    const stock = i18n.t("admin.moduleMenu.suggestedLabelRentals", {
      lng: language,
    })
    return normalizeMenuLabel(stock) === normalized
  })

  if (!isStockLabel) {
    return label
  }

  return t("admin.moduleMenu.suggestedLabelRentals")
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
        label: localizedCustomerMenuLabel(item.moduleName, item.label, t),
        to: menuItemAgendaPath(subdomain, item.id),
        icon: iconForModule(item.moduleName),
      })
    }
  }

  return items
}

/**
 * Module links plus the signed-in account links.
 * Minhas reservas is present when the menu includes rentals and points at that
 * agenda with {@link CUSTOMER_MY_RESERVATIONS_HASH}. Perfil always points at
 * `app/perfil`.
 */
export function buildCustomerShellNavItems(
  subdomain: string,
  menu: readonly ModuleMenuItem[],
  t: TFunction,
): CustomerNavItem[] {
  const items = buildCustomerNavItems(subdomain, menu, t)
  const firstRentals = menu.find(
    (item) => item.moduleName.toLowerCase() === "rentals",
  )

  if (firstRentals) {
    items.push({
      id: "customer-my-reservations",
      label: t("tenantPortal.agenda.myReservations"),
      to: `${menuItemAgendaPath(subdomain, firstRentals.id)}${CUSTOMER_MY_RESERVATIONS_HASH}`,
      icon: ListChecks,
      end: true,
    })
  }

  items.push({
    id: "customer-profile",
    label: t("account.profile"),
    to: tenantPortalPath(subdomain, "app/perfil"),
    icon: CircleUser,
    end: true,
  })

  return items
}
