import { describe, expect, it } from "vitest"

import {
  bookableSummary,
  buildBookableChecklist,
  type BookableChecklistInput,
  type ChecklistItem,
} from "@/features/rentals/components/resourceWizard/bookableChecklist"

const WIZARD = "/configuracoes/recursos/asset-1/assistente"

function input(overrides: Partial<BookableChecklistInput> = {}): BookableChecklistInput {
  return {
    asset: {
      id: "asset-1",
      type: "Location",
      isActive: true,
      schedulePolicy: "SlotGrid",
      openTime: null,
      closeTime: null,
      queueEnabled: false,
      queueOpeningTime: null,
    },
    menuItems: [],
    kinds: [],
    templates: [],
    prices: [],
    access: {
      menuRead: true,
      menuWrite: true,
      kindsRead: true,
      kindsWrite: true,
      scheduleRead: true,
      pricingRead: true,
    },
    wizardPath: WIZARD,
    ...overrides,
  }
}

function item(items: readonly ChecklistItem[], id: ChecklistItem["id"]): ChecklistItem {
  const found = items.find((entry) => entry.id === id)
  if (!found) {
    throw new Error(id)
  }
  return found
}

describe("bookable checklist", () => {
  it("lists every missing prerequisite and points each fix at a step or a one-click action", () => {
    const items = buildBookableChecklist(input())
    expect(items.map((entry) => entry.id)).toEqual([
      "portalMenu",
      "occupancyKinds",
      "schedule",
      "price",
      "queue",
    ])
    expect(item(items, "portalMenu")).toMatchObject({ status: "missing", action: { kind: "createMenu" } })
    expect(item(items, "occupancyKinds")).toMatchObject({ status: "missing", action: { kind: "createKind" } })
    expect(item(items, "schedule")).toMatchObject({ status: "missing", action: { kind: "step", step: "rules" } })
    expect(item(items, "price")).toMatchObject({ status: "missing", action: { kind: "step", step: "prices" } })
    expect(item(items, "queue")).toMatchObject({
      status: "done",
      blocksBooking: false,
      action: { kind: "step", step: "prices" },
    })
    expect(bookableSummary(true, items)).toBe("missing")
  })

  it("is ready when the menu, a bookable kind, a template and a price exist", () => {
    const items = buildBookableChecklist(input({
      menuItems: [{ moduleName: "Rentals", isActive: true, rentalAssetId: null }],
      kinds: [{ isActive: true, isBookableByCustomer: true }],
      templates: [{ isActive: true }],
      prices: [{ pricePerHour: 40 }, { pricePerHour: 0 }],
    }))
    expect(bookableSummary(true, items)).toBe("ready")
  })

  it("does not treat another item's menu entry as coverage", () => {
    const items = buildBookableChecklist(input({
      menuItems: [
        { moduleName: "rentals", isActive: false, rentalAssetId: null },
        { moduleName: "rentals", isActive: true, rentalAssetId: "other" },
        { moduleName: "catalog", isActive: true },
      ],
    }))
    expect(item(items, "portalMenu").status).toBe("missing")
  })

  it("accepts a menu entry scoped to this item", () => {
    const items = buildBookableChecklist(input({
      menuItems: [{ moduleName: "rentals", isActive: true, rentalAssetId: "asset-1" }],
    }))
    expect(item(items, "portalMenu").status).toBe("done")
  })

  it("links the menu when the person can see it but not change it", () => {
    const items = buildBookableChecklist(input({
      access: {
        menuRead: true,
        menuWrite: false,
        kindsRead: true,
        kindsWrite: false,
        scheduleRead: true,
        pricingRead: true,
      },
    }))
    expect(item(items, "portalMenu").action).toEqual({
      kind: "link",
      href: `/configuracoes/menu?returnTo=${encodeURIComponent(WIZARD)}`,
    })
    expect(item(items, "occupancyKinds").action.kind).toBe("link")
  })

  it("does not claim the item is ready when a blocking check cannot be read", () => {
    const items = buildBookableChecklist(input({
      access: {
        menuRead: false,
        menuWrite: false,
        kindsRead: true,
        kindsWrite: true,
        scheduleRead: true,
        pricingRead: true,
      },
      menuItems: null,
      kinds: [{ isActive: true, isBookableByCustomer: true }],
      templates: [{ isActive: true }],
      prices: [{ pricePerHour: 10 }],
    }))
    expect(item(items, "portalMenu").status).toBe("unavailable")
    expect(bookableSummary(true, items)).toBe("unknown")
  })

  it("treats open hours as the schedule and does not require occupancy kinds", () => {
    const items = buildBookableChecklist(input({
      asset: {
        id: "asset-1",
        type: "Location",
        isActive: true,
        schedulePolicy: "OpenHours",
        openTime: "08:00:00",
        closeTime: "22:00:00",
        queueEnabled: false,
        queueOpeningTime: null,
      },
      menuItems: [{ moduleName: "rentals", isActive: true }],
      prices: [{ pricePerHour: 15 }],
    }))
    expect(item(items, "schedule").status).toBe("done")
    expect(item(items, "occupancyKinds")).toMatchObject({
      status: "notApplicable",
      blocksBooking: false,
    })
    expect(bookableSummary(true, items)).toBe("ready")
  })

  it("keeps open hours pending until both clocks are set", () => {
    const items = buildBookableChecklist(input({
      asset: {
        id: "asset-1",
        type: "Location",
        isActive: true,
        schedulePolicy: "OpenHours",
        openTime: "08:00",
        closeTime: "  ",
        queueEnabled: false,
        queueOpeningTime: null,
      },
    }))
    expect(item(items, "schedule").status).toBe("missing")
  })

  it("blocks a location whose queue is on without an opening time", () => {
    const items = buildBookableChecklist(input({
      asset: {
        id: "asset-1",
        type: "Location",
        isActive: true,
        schedulePolicy: "SlotGrid",
        queueEnabled: true,
        queueOpeningTime: null,
      },
      menuItems: [{ moduleName: "rentals", isActive: true }],
      kinds: [{ isActive: true, isBookableByCustomer: true }],
      templates: [{ isActive: true }],
      prices: [{ pricePerHour: 10 }],
    }))
    expect(item(items, "queue")).toMatchObject({
      status: "missing",
      blocksBooking: true,
      action: { kind: "step", step: "prices" },
    })
    expect(bookableSummary(true, items)).toBe("missing")
  })

  it("does not apply the queue to a good", () => {
    const items = buildBookableChecklist(input({
      asset: {
        id: "asset-1",
        type: "Good",
        isActive: true,
        schedulePolicy: "SlotGrid",
        queueEnabled: true,
        queueOpeningTime: null,
      },
    }))
    expect(item(items, "queue")).toMatchObject({
      status: "notApplicable",
      blocksBooking: false,
      action: { kind: "none" },
    })
  })

  it("reports an inactive item even when every check is done", () => {
    const items = buildBookableChecklist(input({
      menuItems: [{ moduleName: "rentals", isActive: true }],
      kinds: [{ isActive: true, isBookableByCustomer: true }],
      templates: [{ isActive: true }],
      prices: [{ pricePerHour: 10 }],
    }))
    expect(bookableSummary(false, items)).toBe("inactive")
  })

  it("ignores an inactive occupancy kind", () => {
    const items = buildBookableChecklist(input({
      kinds: [{ isActive: false, isBookableByCustomer: true }],
    }))
    expect(item(items, "occupancyKinds").status).toBe("missing")
  })
})
