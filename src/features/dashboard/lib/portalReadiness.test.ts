import { describe, expect, it } from "vitest"

import { pendingPortalChecks } from "@/features/dashboard/lib/portalReadiness"

const groups = [
  { id: "group-1", memberCustomerIds: [] as string[] },
  { id: "group-2", memberCustomerIds: ["customer-1"] },
]

describe("pendingPortalChecks", () => {
  it("asks for the customer menu when an active portal module has no live item", () => {
    expect(pendingPortalChecks({
      activeModules: ["catalog", "rentals"],
      menuItems: [
        { moduleName: "catalog", isActive: true },
        { moduleName: "rentals", isActive: false },
      ],
      products: [],
      groups: [],
      accessByProductId: {},
    })).toEqual([{ key: "portalMenu", href: "/configuracoes/menu" }])
  })

  it("stays quiet when every active portal module is on the menu", () => {
    expect(pendingPortalChecks({
      activeModules: ["catalog"],
      menuItems: [{ moduleName: "Catálogo", isActive: true }],
      products: [{ id: "public", visibility: "Public" }],
      groups,
      accessByProductId: {},
    })).toEqual([])
  })

  it("flags a restricted product whose groups have no members and no named customer", () => {
    expect(pendingPortalChecks({
      activeModules: ["catalog"],
      menuItems: [{ moduleName: "catalog", isActive: true }],
      products: [
        { id: "public", visibility: "Public" },
        { id: "kit", visibility: "Restricted" },
      ],
      groups,
      accessByProductId: {
        kit: { customerIds: [], groupIds: ["group-1"] },
      },
    })).toEqual([{ key: "emptyGroup", href: "/catalogo/grupos/group-1" }])
  })

  it("accepts a restricted product granted to a group that has a member", () => {
    expect(pendingPortalChecks({
      activeModules: [],
      menuItems: null,
      products: [{ id: "kit", visibility: "Restricted" }],
      groups,
      accessByProductId: {
        kit: { customerIds: [], groupIds: ["group-2"] },
      },
    })).toEqual([])
  })
})
