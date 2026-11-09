import { describe, expect, it } from "vitest"

import {
  audienceBlocksSale,
  buildSellableChecklist,
  sellableSummary,
  type SellableChecklistInput,
} from "@/features/catalog/components/productWizard/sellableChecklist"

const PRODUCT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function input(overrides: Partial<SellableChecklistInput> = {}): SellableChecklistInput {
  return {
    product: { id: PRODUCT_ID, isActive: true, visibility: "Public" },
    access: { visibility: "Public", customerIds: [], groupIds: [] },
    groups: [],
    menuItems: [{ moduleName: "catalog", isActive: true }],
    requirements: [],
    resourceCapability: "ready",
    rentalsActive: true,
    permissions: { menuRead: true, menuWrite: true },
    ...overrides,
  }
}

function item(items: ReturnType<typeof buildSellableChecklist>, id: string) {
  const found = items.find((entry) => entry.id === id)
  if (!found) {
    throw new Error(`missing ${id}`)
  }
  return found
}

describe("sellable checklist", () => {
  it("is ready when the product is public, listed, on the menu, and uses no resource", () => {
    const items = buildSellableChecklist(input())
    expect(items.map((entry) => [entry.id, entry.status])).toEqual([
      ["listed", "done"],
      ["portalMenu", "done"],
      ["audience", "done"],
      ["resource", "done"],
    ])
    expect(item(items, "resource").blocksSale).toBe(false)
    expect(sellableSummary(true, items)).toBe("ready")
  })

  it("blocks a sale that is restricted to a group with zero members", () => {
    const items = buildSellableChecklist(input({
      product: { id: PRODUCT_ID, isActive: true, visibility: "Restricted" },
      access: { visibility: "Restricted", customerIds: [], groupIds: ["group-1"] },
      groups: [{ id: "group-1", memberCustomerIds: [] }],
    }))
    const audience = item(items, "audience")
    expect(audience.status).toBe("missing")
    expect(audience.blocksSale).toBe(true)
    expect(audience.action).toEqual({
      kind: "link",
      href: `/catalogo/grupos/group-1?returnTo=${encodeURIComponent(`/catalogo/produtos/${PRODUCT_ID}/assistente?passo=access`)}`,
    })
    expect(sellableSummary(true, items)).toBe("missing")
  })

  it("does not block when the empty group is paired with a named customer", () => {
    expect(audienceBlocksSale(
      { visibility: "Restricted", customerIds: ["customer-1"], groupIds: ["group-1"] },
      [{ id: "group-1", memberCustomerIds: [] }],
    )).toBe(false)
  })

  it("blocks a restricted product with no grants at all", () => {
    const items = buildSellableChecklist(input({
      access: { visibility: "Restricted", customerIds: [], groupIds: [] },
    }))
    const audience = item(items, "audience")
    expect(audience.status).toBe("missing")
    expect(audience.action).toEqual({ kind: "step", step: "access" })
  })

  it("offers an in-place menu publish when the catalog item is missing or hidden", () => {
    const hidden = buildSellableChecklist(input({
      menuItems: [{ moduleName: "Catálogo", isActive: false }],
    }))
    expect(item(hidden, "portalMenu")).toMatchObject({
      status: "missing",
      action: { kind: "createMenu" },
    })
    const readOnly = buildSellableChecklist(input({
      menuItems: [],
      permissions: { menuRead: true, menuWrite: false },
    }))
    expect(item(readOnly, "portalMenu").action.kind).toBe("link")
  })

  it("treats a requirement without a resource as unset and blocking", () => {
    const items = buildSellableChecklist(input({
      requirements: [{ rentalAssetId: null }, { rentalAssetId: "  " }],
    }))
    expect(item(items, "resource")).toMatchObject({
      status: "missing",
      blocksSale: true,
      action: { kind: "step", step: "resource" },
    })
  })

  it("does not block when a resource is chosen", () => {
    const items = buildSellableChecklist(input({
      requirements: [{ rentalAssetId: "asset-1" }],
    }))
    expect(item(items, "resource").status).toBe("done")
    expect(item(items, "resource").blocksSale).toBe(true)
  })

  it("does not pretend resource setup exists when this business has no rentals", () => {
    const items = buildSellableChecklist(input({ rentalsActive: false, requirements: null }))
    expect(item(items, "resource")).toMatchObject({
      status: "notApplicable",
      blocksSale: false,
      action: { kind: "none" },
    })
    expect(sellableSummary(true, items)).toBe("ready")
  })

  it("explains an API module refusal without blocking the sale", () => {
    const items = buildSellableChecklist(input({
      resourceCapability: "inactive",
      requirements: null,
    }))
    expect(item(items, "resource")).toMatchObject({
      status: "unavailable",
      blocksSale: false,
    })
    expect(sellableSummary(true, items)).toBe("ready")
  })

  it("stays unknown when the menu or the requirements could not be read", () => {
    const items = buildSellableChecklist(input({
      menuItems: null,
      requirements: null,
      resourceCapability: "unknown",
    }))
    expect(item(items, "portalMenu").status).toBe("unavailable")
    expect(item(items, "resource").status).toBe("unavailable")
    expect(sellableSummary(true, items)).toBe("unknown")
  })

  it("reports inactive before other gaps", () => {
    const items = buildSellableChecklist(input({
      product: { id: PRODUCT_ID, isActive: false, visibility: "Public" },
      menuItems: [],
    }))
    expect(item(items, "listed").status).toBe("missing")
    expect(sellableSummary(false, items)).toBe("inactive")
  })
})
