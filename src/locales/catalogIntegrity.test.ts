import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import en from "@/locales/en/common.json"
import es from "@/locales/es/common.json"
import ptBR from "@/locales/pt-BR/common.json"
import { ptBRPermissionCopy } from "@/locales/pt-BR/permissionCopy"

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    expect(value.trim(), prefix).not.toBe("")
    return [prefix]
  }

  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid translation at ${prefix}`)
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    leafKeys(entry, prefix ? `${prefix}.${key}` : key),
  )
}

describe("translation catalog integrity", () => {
  it.each(["pt-BR", "en", "es"])("keeps portal greetings free of the wave emoji in %s", (lng) => {
    for (const key of ["tenantPortal.redesign.greeting", "tenantPortal.redesign.greetingName"]) {
      expect(i18n.exists(key, { lng })).toBe(true)
      expect(i18n.t(key, { lng, name: "Ana" })).not.toContain("👋")
    }
  })

  it.each(["pt-BR", "en", "es"])("translates staff sales navigation and new states in %s", (lng) => {
    const keys = [
      "nav.catalogRequests", "catalog.staff.allStatuses", "catalog.staff.productsSearch", "catalog.staff.ordersSearch",
      "catalog.staff.loading", "catalog.staff.noResults", "catalog.staff.adjustFilters",
      "catalog.staff.orderSummary", "catalog.staff.noNote", "catalog.staff.empty.products",
      "catalog.staff.empty.orders", "catalog.staff.empty.requests", "catalog.staff.kpis.Requested",
      "catalog.staff.kpis.Approved", "catalog.staff.kpis.Preparing", "catalog.staff.kpis.Ready",
    ]
    for (const key of keys) {
      expect(i18n.exists(key, { lng })).toBe(true)
      expect(i18n.t(key, { lng })).not.toBe(key)
      expect(i18n.t(key, { lng })).not.toMatch(/\b(?:quadras?|courts?|canchas?)\b/iu)
    }
  })

  it.each(["pt-BR", "en", "es"])(
    "uses asset and equipment wording throughout Assets in %s",
    (locale) => {
      const assets: unknown = i18n.getResource(locale, "common", "assets")
      const text = (value: unknown): string => typeof value === "string"
        ? value
        : Object.values(value as Record<string, unknown>).map(text).join("\n")
      expect(text(assets)).not.toMatch(/\b(?:rental\w*|rentable\w*|locaç\w*|alugu\w*|alugá\w*|alquil\w*|quadra\w*|courts?|canchas?)\b/iu)
    },
  )

  it.each([
    ["pt-BR", "Motivo: Indisponível", "R$ 10 / un"],
    ["en", "Reason: Indisponível", "R$ 10 / unit"],
    ["es", "Motivo: Indisponível", "R$ 10 / ud."],
  ])("translates order reasons and unit prices in %s", (lng, reason, unitPrice) => {
    expect(i18n.t("tenantPortal.catalog.purchase.reason", { lng, reason: "Indisponível" })).toBe(reason)
    expect(i18n.t("tenantPortal.catalog.unitPrice", { lng, price: "R$ 10" })).toBe(unitPrice)
  })

  it("keeps the assigned work order empty state in UTF-8", () => {
    expect(i18n.t("workOrders.emptyAssigned.Open", { lng: "pt-BR" })).toBe("Nenhuma OS aberta atribuída a você.")
  })
  it.each([
    { locale: "en", catalog: en },
    { locale: "es", catalog: es },
  ])("keeps the same nonempty keys in $locale and pt-BR", ({ catalog }) => {
    expect(leafKeys(catalog).sort()).toEqual(leafKeys(ptBR).sort())
  })

  it.each(["pt-BR", "en", "es"])(
    "preserves the complete catalog and permission copy in %s at runtime",
    (locale) => {
      const resources: unknown = i18n.getResourceBundle(locale, "common")
      const expected = [...leafKeys(ptBR), ...leafKeys(ptBRPermissionCopy)]
      expect(leafKeys(resources).sort()).toEqual(expected.sort())
    },
  )
})
