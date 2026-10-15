import { afterEach, describe, expect, it } from "vitest"

import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import i18n from "@/lib/i18n"

import { isCustomerNavItemActive } from "@/features/catalog/customerNavActive"

import {
  buildCustomerNavItems,
  buildCustomerShellNavItems,
  CUSTOMER_MY_RESERVATIONS_HASH,
  getDiscoverablePortalModules,
  getEligiblePortalMenuModules,
  getVisiblePortalMenuItems,
  localizedCustomerMenuLabel,
  PORTAL_CUSTOMER_MODULES,
  suggestPortalMenuLabel,
} from "./customerNav"

const RENTALS_A: ModuleMenuItem = {
  id: "11111111-1111-4111-8111-111111111111",
  moduleName: "rentals",
  label: "Quadra 1",
  sortOrder: 20,
  isActive: true,
  rentalAssetId: null,
}

const RENTALS_B: ModuleMenuItem = {
  id: "22222222-2222-4222-8222-222222222222",
  moduleName: "rentals",
  label: "Agenda geral",
  sortOrder: 10,
  isActive: true,
  rentalAssetId: null,
}

const INACTIVE_RENTALS: ModuleMenuItem = {
  id: "33333333-3333-4333-8333-333333333333",
  moduleName: "rentals",
  label: "Oculto",
  sortOrder: 5,
  isActive: false,
  rentalAssetId: null,
}

const CATALOG: ModuleMenuItem = {
  id: "44444444-4444-4444-8444-444444444444",
  moduleName: "catalog",
  label: "Nome customizado do catálogo",
  sortOrder: 30,
  isActive: true,
  rentalAssetId: null,
}

const CATALOGO_ALIAS: ModuleMenuItem = {
  id: "55555555-5555-4555-8555-555555555555",
  moduleName: "catalogo",
  label: "Outro catálogo",
  sortOrder: 40,
  isActive: true,
  rentalAssetId: null,
}

const INVENTORY: ModuleMenuItem = {
  id: "66666666-6666-4666-8666-666666666666",
  moduleName: "inventory",
  label: "Ativos",
  sortOrder: 1,
  isActive: true,
  rentalAssetId: null,
}

describe("getEligiblePortalMenuModules / getDiscoverablePortalModules", () => {
  it("intersects B2C-supported modules with the tenant active set", () => {
    expect(getEligiblePortalMenuModules(["rentals", "inventory"])).toEqual([
      "rentals",
    ])
    expect(getEligiblePortalMenuModules(["Catalog", "Rentals"])).toEqual([
      "rentals",
      "catalog",
    ])
    expect(getEligiblePortalMenuModules(["inventory", "pmoc"])).toEqual([])
  })

  it("lists B2C modules that are not active for discovery", () => {
    expect(getDiscoverablePortalModules(["rentals"])).toEqual(["catalog"])
    expect(getDiscoverablePortalModules(["catalog"])).toEqual(["rentals"])
    expect(getDiscoverablePortalModules(["rentals", "catalog"])).toEqual([])
    expect(getDiscoverablePortalModules([])).toEqual([
      ...PORTAL_CUSTOMER_MODULES,
    ])
  })
})

describe("getVisiblePortalMenuItems", () => {
  it("drops inactive items and modules not in the tenant set", () => {
    const visible = getVisiblePortalMenuItems(
      [INACTIVE_RENTALS, INVENTORY, RENTALS_A, CATALOG],
      ["rentals", "Catalog"],
    )

    expect(visible.map((item) => item.id)).toEqual([RENTALS_A.id, CATALOG.id])
  })

  it("matches catalog aliases case-insensitively against tenant modules", () => {
    const visible = getVisiblePortalMenuItems([CATALOGO_ALIAS, RENTALS_A], [
      "CATALOG",
    ])

    expect(visible.map((item) => item.id)).toEqual([CATALOGO_ALIAS.id])
  })

  it("sorts by sortOrder then label", () => {
    const laterLabelFirst: ModuleMenuItem = {
      ...RENTALS_A,
      sortOrder: 10,
      label: "Zulu",
    }
    const earlierLabel: ModuleMenuItem = {
      ...RENTALS_B,
      sortOrder: 10,
      label: "Alpha",
    }

    const visible = getVisiblePortalMenuItems(
      [laterLabelFirst, earlierLabel],
      ["rentals"],
    )

    expect(visible.map((item) => item.label)).toEqual(["Alpha", "Zulu"])
  })
})

describe("buildCustomerNavItems", () => {
  it("keeps catalog split semantics and ignores the configured catalog label", () => {
    const nav = buildCustomerNavItems(
      "clube",
      [RENTALS_B, CATALOG, CATALOGO_ALIAS],
      i18n.t,
    )

    expect(nav.map((item) => item.label)).toEqual([
      RENTALS_B.label,
      i18n.t("tenantPortal.catalog.navCatalog"),
      i18n.t("tenantPortal.catalog.navOrders"),
    ])
    expect(nav[1]?.to).toContain("catalogo")
    expect(nav[2]?.to).toContain("pedidos")
    expect(nav.some((item) => item.label === CATALOG.label)).toBe(false)
  })

  it("does not render inventory, pmoc or os items", () => {
    const nav = buildCustomerNavItems("clube", [INVENTORY, RENTALS_A], i18n.t)

    expect(nav).toHaveLength(1)
    expect(nav[0]?.id).toBe(RENTALS_A.id)
    expect(nav[0]?.label).toBe(RENTALS_A.label)
  })
})

describe("buildCustomerShellNavItems", () => {
  it("lists book, my reservations, and profile for a signed-in rentals menu", () => {
    const stock = { ...RENTALS_B, label: "Reservar horário" }
    const nav = buildCustomerShellNavItems("clube", [stock], i18n.t)

    expect(nav.map((item) => item.label)).toEqual([
      i18n.t("admin.moduleMenu.suggestedLabelRentals"),
      i18n.t("tenantPortal.agenda.myReservations"),
      i18n.t("account.profile"),
    ])
    expect(nav[0]?.to).toBe(`/t/clube/agenda/${stock.id}`)
    expect(nav[1]?.to).toBe(
      `/t/clube/agenda/${stock.id}${CUSTOMER_MY_RESERVATIONS_HASH}`,
    )
    expect(nav[2]?.to).toBe("/t/clube/app/perfil")
  })

  it("keeps catalog links and skips my reservations when rentals is absent", () => {
    const nav = buildCustomerShellNavItems("clube", [CATALOG], i18n.t)

    expect(nav.map((item) => item.label)).toEqual([
      i18n.t("tenantPortal.catalog.navCatalog"),
      i18n.t("tenantPortal.catalog.navOrders"),
      i18n.t("account.profile"),
    ])
    expect(nav.some((item) => item.to.includes("agenda"))).toBe(false)
  })

  it("highlights my reservations only when the agenda hash is present", () => {
    const stock = { ...RENTALS_B, label: "Reservar horário" }
    const nav = buildCustomerShellNavItems("clube", [stock], i18n.t)
    const agendaPath = `/t/clube/agenda/${stock.id}`

    expect(
      isCustomerNavItemActive(nav[0]!, nav, agendaPath, ""),
    ).toBe(true)
    expect(
      isCustomerNavItemActive(nav[1]!, nav, agendaPath, ""),
    ).toBe(false)
    expect(
      isCustomerNavItemActive(
        nav[1]!,
        nav,
        agendaPath,
        CUSTOMER_MY_RESERVATIONS_HASH,
      ),
    ).toBe(true)
    expect(
      isCustomerNavItemActive(
        nav[0]!,
        nav,
        agendaPath,
        CUSTOMER_MY_RESERVATIONS_HASH,
      ),
    ).toBe(false)
  })
})

describe("localizedCustomerMenuLabel", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("translates the stock rentals label and keeps tenant resource names", async () => {
    const stock: ModuleMenuItem = {
      ...RENTALS_B,
      label: "Reservar horário",
    }

    await i18n.changeLanguage("en")
    expect(buildCustomerNavItems("clube", [stock, RENTALS_A], i18n.t).map(
      (item) => item.label,
    )).toEqual(["Book a time", "Quadra 1"])

    await i18n.changeLanguage("es")
    expect(localizedCustomerMenuLabel("rentals", "Book a time", i18n.t)).toBe(
      "Reservar horario",
    )
    expect(localizedCustomerMenuLabel("rentals", "Quadra 1", i18n.t)).toBe(
      "Quadra 1",
    )
    expect(
      localizedCustomerMenuLabel("rentals", "Reservar Quadra 1", i18n.t),
    ).toBe("Reservar Quadra 1")
  })
})

describe("suggestPortalMenuLabel", () => {
  it("suggests the schedule label when rentals has no asset", () => {
    expect(
      suggestPortalMenuLabel({
        moduleName: "rentals",
        rentalAssetName: null,
        t: i18n.t,
      }),
    ).toBe(i18n.t("admin.moduleMenu.suggestedLabelRentals"))
  })

  it("suggests Reservar {name} when rentals has an asset", () => {
    expect(
      suggestPortalMenuLabel({
        moduleName: "Rentals",
        rentalAssetName: "Quadra A",
        t: i18n.t,
      }),
    ).toBe(
      i18n.t("admin.moduleMenu.suggestedLabelRentalsAsset", {
        name: "Quadra A",
      }),
    )
  })

  it("suggests the catalog i18n label", () => {
    expect(
      suggestPortalMenuLabel({
        moduleName: "catalogo",
        t: i18n.t,
      }),
    ).toBe(i18n.t("tenantPortal.catalog.navCatalog"))
  })
})
