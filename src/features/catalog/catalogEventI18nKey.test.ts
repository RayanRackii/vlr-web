import { describe, expect, it } from "vitest"

import { CATALOG_EVENT_TYPES, catalogEventI18nKey } from "@/features/catalog/schemas/catalogSchemas"
import i18n from "@/lib/i18n"

describe("catalogEventI18nKey", () => {
  it("maps dotted event types to nested i18n keys", () => {
    expect(catalogEventI18nKey("catalog.order.created")).toBe(
      "catalog.events.orderCreated",
    )
    expect(catalogEventI18nKey("catalog.order.cancelled_by_supplier")).toBe(
      "catalog.events.orderCancelledBySupplier",
    )
    expect(catalogEventI18nKey("catalog.order.cancelled_by_customer")).toBe(
      "catalog.events.orderCancelledByCustomer",
    )
  })

  it("translates a customer cancellation instead of showing the raw event type", async () => {
    expect(CATALOG_EVENT_TYPES).toContain("catalog.order.cancelled_by_customer")
    for (const language of ["pt-BR", "en", "es"] as const) {
      await i18n.changeLanguage(language)
      const label = i18n.t("catalog.events.orderCancelledByCustomer")
      expect(label).not.toBe("catalog.events.orderCancelledByCustomer")
      expect(label).not.toBe("catalog.order.cancelled_by_customer")
    }
    await i18n.changeLanguage("pt-BR")
  })

  it("returns the original value for unknown events", () => {
    expect(catalogEventI18nKey("catalog.order.unknown")).toBe(
      "catalog.order.unknown",
    )
  })
})
