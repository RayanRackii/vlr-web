import { describe, expect, it } from "vitest"

import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import i18n from "@/lib/i18n"

import {
  buildCustomerNavItems,
  getVisiblePortalMenuItems,
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
