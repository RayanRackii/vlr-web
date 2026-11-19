import { describe, expect, it } from "vitest"

import {
  listAttributeChips,
  numericAttribute,
  toSafeHttpUrl,
} from "@/features/assets/lib/assetAttributeSummary"
import { formatAttributeValue } from "@/features/assets/lib/assetAttributeValues"
import type { AssetFamilyField } from "@/features/assets/schemas/assetFamilySchemas"

const f = (partial: Partial<AssetFamilyField> & Pick<AssetFamilyField, "key" | "type">): AssetFamilyField => ({
  required: false,
  label: partial.key,
  ...partial,
})

describe("formatAttributeValue per type", () => {
  it("formats numbers with locale and unit, typed or legacy", () => {
    expect(formatAttributeValue({ type: "number", unit: "mm" }, 0.02, "pt-BR")).toBe("0,02 mm")
    expect(formatAttributeValue({ type: "number", unit: "mm" }, 0.02, "en")).toBe("0.02 mm")
    expect(formatAttributeValue({ type: "number", unit: null }, "1234.5", "en")).toBe("1,234.5")
    expect(formatAttributeValue({ type: "number", unit: "mm" }, "abc", "en")).toBe("abc")
  })

  it("formats arrays, booleans and absent values", () => {
    expect(formatAttributeValue({ type: "multiselect", unit: null }, ["PLA", "PETG"], "en")).toBe("PLA, PETG")
    expect(formatAttributeValue({ type: "boolean", unit: null }, true, "en")).toBe("true")
    expect(formatAttributeValue({ type: "text", unit: null }, "", "en")).toBe("")
    expect(formatAttributeValue({ type: "multiselect", unit: null }, [], "en")).toBe("")
    expect(formatAttributeValue({ type: "text", unit: null }, undefined, "en")).toBe("")
  })
})

describe("toSafeHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(toSafeHttpUrl("https://a.io/x")?.host).toBe("a.io")
    expect(toSafeHttpUrl("http://a.io")?.host).toBe("a.io")
    expect(toSafeHttpUrl("javascript:alert(1)")).toBeNull()
    expect(toSafeHttpUrl("data:text/html,x")).toBeNull()
    expect(toSafeHttpUrl("//a.io")).toBeNull()
    expect(toSafeHttpUrl("")).toBeNull()
  })
})

describe("numericAttribute", () => {
  it("reads typed and legacy numbers", () => {
    expect(numericAttribute(5)).toBe(5)
    expect(numericAttribute("0.5")).toBe(0.5)
    expect(numericAttribute("0,5")).toBeNull()
    expect(numericAttribute("1,000")).toBeNull()
    expect(numericAttribute(true)).toBeNull()
    expect(numericAttribute(undefined)).toBeNull()
  })
})

describe("listAttributeChips", () => {
  const fields = [
    f({ key: "model", type: "text" }),
    f({ key: "mat", type: "multiselect", label: "Materiais" }),
    f({ key: "size", type: "number", label: "Tamanho", unit: "mm" }),
    f({ key: "kind", type: "select", label: "Tipo" }),
    f({ key: "old", type: "select", archived: true }),
  ]

  it("takes select, multiselect and number values in field order, capped at three", () => {
    const { chips, hidden } = listAttributeChips(
      fields,
      { model: "x", mat: ["PLA", "PETG"], size: 256, kind: "A", old: "Z" },
      "pt-BR",
    )
    expect(chips.map((chip) => chip.text)).toEqual(["PLA", "PETG", "256 mm"])
    expect(chips[2]?.title).toBe("Tamanho: 256 mm")
    expect(hidden).toBe(1)
  })

  it("skips absent values and archived fields, splits legacy multiselect strings", () => {
    const { chips, hidden } = listAttributeChips(fields, { mat: "PLA, ABS", size: "", old: "Z" }, "en")
    expect(chips.map((chip) => chip.text)).toEqual(["PLA", "ABS"])
    expect(hidden).toBe(0)
  })

  it("returns nothing when no field has a value", () => {
    expect(listAttributeChips(fields, {}, "en")).toEqual({ chips: [], hidden: 0 })
  })
})
