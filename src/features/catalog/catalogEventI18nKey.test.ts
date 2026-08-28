import { describe, expect, it } from "vitest"

import { catalogEventI18nKey } from "@/features/catalog/schemas/catalogSchemas"

describe("catalogEventI18nKey", () => {
  it("maps dotted event types to nested i18n keys", () => {
    expect(catalogEventI18nKey("catalog.order.created")).toBe(
      "catalog.events.orderCreated",
    )
    expect(catalogEventI18nKey("catalog.order.cancelled_by_supplier")).toBe(
      "catalog.events.orderCancelledBySupplier",
    )
  })

  it("returns the original value for unknown events", () => {
    expect(catalogEventI18nKey("catalog.order.unknown")).toBe(
      "catalog.order.unknown",
    )
  })
})
