import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { describeOrderHistoryEntry } from "@/features/catalog/lib/orderHistoryText"

describe("describeOrderHistoryEntry", () => {
  it.each([
    ["pt-BR", "Aprovado", "Trabalho concluído"],
    ["en", "Approved", "Work finished"],
    ["es", "Aprobado", "Trabajo finalizado"],
  ])("resolves the message key in %s", async (lng, approved, usage) => {
    const t = i18n.getFixedT(lng)
    expect(describeOrderHistoryEntry({ messageKey: "catalog.order.history.approved" }, t, "fb")).toBe(approved)
    expect(describeOrderHistoryEntry({ messageKey: "catalog.order.history.usageWorkFinished", messageParams: null }, t, "fb")).toBe(usage)
  })

  it("falls back when the key is absent or unknown", () => {
    const t = i18n.getFixedT("en")
    expect(describeOrderHistoryEntry({}, t, "Fallback")).toBe("Fallback")
    expect(describeOrderHistoryEntry({ messageKey: null }, t, "Fallback")).toBe("Fallback")
    expect(describeOrderHistoryEntry({ messageKey: "catalog.order.history.nope", messageParams: { reason: "x" } }, t, "Fallback")).toBe("Fallback")
  })
})
