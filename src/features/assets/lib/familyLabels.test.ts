import { describe, expect, it } from "vitest"

import i18n from "@/lib/i18n"
import { familyFieldLabel, familyLabel } from "@/features/assets/lib/familyLabels"

describe("family labels", () => {
  it.each([
    ["pt-BR", "Bens e itens", "Quantidade típica"],
    ["en", "Goods and items", "Typical quantity"],
    ["es", "Bienes y artículos", "Cantidad típica"],
  ])("translates seeded labels in %s", (lng, family, field) => {
    const t = i18n.getFixedT(lng)
    expect(familyLabel(t, { label: "x", labelKey: "assetFamilies.goods.label" })).toBe(family)
    expect(familyFieldLabel(t, { key: "quantity_hint", labelKey: "assetFamilies.goods.fields.quantity_hint.label" })).toBe(field)
  })

  it("keeps stored labels when there is no key or no translation", () => {
    const t = i18n.getFixedT("en")
    expect(familyLabel(t, { label: "Custom" })).toBe("Custom")
    expect(familyLabel(t, { label: "Custom", labelKey: "assetFamilies.nope.label" })).toBe("Custom")
    expect(familyFieldLabel(t, { key: "k", label: "Stored" })).toBe("Stored")
    expect(familyFieldLabel(t, { key: "k", label: "Stored", labelKey: "assetFamilies.nope.fields.k.label" })).toBe("Stored")
    expect(familyFieldLabel(t, { key: "k" }, "Legacy")).toBe("Legacy")
  })
})
