import { describe, expect, it } from "vitest"

import {
  attributeToInputString,
  formatAttributeValue,
  isBlankFormValue,
  normalizeNumberInput,
  toFormValue,
  toPayloadValue,
  untouchedStoredValue,
} from "@/features/assets/lib/assetAttributeValues"
import { assetSchema } from "@/features/assets/schemas/assetSchemas"
import { assetFamilySchema } from "@/features/assets/schemas/assetFamilySchemas"

describe("attributeToInputString", () => {
  it.each([
    ["256", "256"],
    [12, "12"],
    [0.02, "0.02"],
    [true, "true"],
    [false, "false"],
    [["PLA", "PETG"], "PLA, PETG"],
    [[], ""],
    [null, ""],
    [undefined, ""],
  ])("converts %j to %j", (value, expected) => {
    expect(attributeToInputString(value)).toBe(expected)
  })
})

describe("tolerant attribute schemas", () => {
  const base = {
    id: "44444444-4444-4444-8444-444444444444",
    tenantId: "11111111-1111-4111-8111-111111111111",
    unitId: "11111111-1111-4111-8111-111111111111",
    categoryId: "22222222-2222-4222-8222-222222222222",
    familyId: "33333333-3333-4333-8333-333333333333",
    name: "Impressora",
    tag: "P-01",
    status: "Active",
    isRentable: false,
    requiresMaintenance: false,
    createdAt: "2026-10-25T00:00:00Z",
  }

  it("parses string, number, boolean, array and null attribute values", () => {
    const asset = assetSchema.parse({
      ...base,
      attributes: { a: "x", b: 12, c: true, d: ["PLA"], e: null },
    })
    expect(asset.attributes).toEqual({ a: "x", b: 12, c: true, d: ["PLA"], e: null })
  })

  it("drops archived family fields and accepts v2 field properties", () => {
    const family = assetFamilySchema.parse({
      id: base.familyId,
      key: "printer_3d",
      label: "Impressora 3D",
      sortOrder: 0,
      isActive: true,
      fields: [
        { key: "build_x_mm", type: "number", required: false, label: "X", unit: "mm", min: 0, max: null, decimals: 1, group: "Volume" },
        { key: "materials", type: "multiselect", required: false, options: ["PLA"] },
        { key: "old", type: "text", required: false, archived: true },
      ],
    })
    expect(family.fields.map((f) => f.key)).toEqual(["build_x_mm", "materials"])
    expect(family.fields[0].unit).toBe("mm")
  })
})

describe("normalizeNumberInput", () => {
  it.each([
    ["256", "256"],
    ["0.02", "0.02"],
    ["0,02", "0.02"],
    ["-1,5", "-1.5"],
    [" 7 ", "7"],
    ["1.234,5", null],
    ["1,000.5", null],
    ["1e3", null],
    ["1,2,3", null],
    ["abc", null],
    ["", null],
    [",5", null],
  ])("normalizes %j to %j", (raw, expected) => {
    expect(normalizeNumberInput(raw)).toBe(expected)
  })
})

describe("toFormValue", () => {
  const multi = { type: "multiselect" } as const
  it("reads multiselect from an array and from a legacy comma string", () => {
    expect(toFormValue(multi, ["PLA", "PETG"])).toEqual(["PLA", "PETG"])
    expect(toFormValue(multi, "PLA, petg, PLA,")).toEqual(["PLA", "petg"])
    expect(toFormValue(multi, null)).toEqual([])
    expect(toFormValue(multi, undefined)).toEqual([])
  })
  it("reads booleans from typed and legacy values", () => {
    const field = { type: "boolean" } as const
    expect(toFormValue(field, true)).toBe(true)
    expect(toFormValue(field, "true")).toBe(true)
    expect(toFormValue(field, "1")).toBe(true)
    expect(toFormValue(field, "false")).toBe(false)
    expect(toFormValue(field, undefined)).toBe(false)
  })
  it("reads everything else as a string", () => {
    expect(toFormValue({ type: "number" }, 12)).toBe("12")
    expect(toFormValue({ type: "number" }, "256")).toBe("256")
    expect(toFormValue({ type: "text" }, null)).toBe("")
  })
})

describe("toPayloadValue", () => {
  it("sends numbers as numbers and normalizes a decimal comma", () => {
    expect(toPayloadValue({ type: "number" }, "256")).toBe(256)
    expect(toPayloadValue({ type: "number" }, "0,02")).toBe(0.02)
    expect(toPayloadValue({ type: "number" }, " 1.5 ")).toBe(1.5)
  })
  it("keeps an invalid number as text so the API rejects it", () => {
    expect(toPayloadValue({ type: "number" }, "1.234,5")).toBe("1.234,5")
  })
  it("sends booleans, arrays and blanks", () => {
    expect(toPayloadValue({ type: "boolean" }, true)).toBe(true)
    expect(toPayloadValue({ type: "boolean" }, "false")).toBe(false)
    expect(toPayloadValue({ type: "multiselect" }, ["PLA"])).toEqual(["PLA"])
    expect(toPayloadValue({ type: "multiselect" }, [])).toBeNull()
    expect(toPayloadValue({ type: "text" }, "  ")).toBeNull()
    expect(toPayloadValue({ type: "text" }, " ok ")).toBe("ok")
    expect(toPayloadValue({ type: "number" }, "")).toBeNull()
  })
  it("round-trips a multiselect from a legacy string and from an array", () => {
    const field = { type: "multiselect" } as const
    expect(toPayloadValue(field, toFormValue(field, "PLA, PETG"))).toEqual(["PLA", "PETG"])
    expect(toPayloadValue(field, toFormValue(field, ["PLA", "PETG"]))).toEqual(["PLA", "PETG"])
  })
})

describe("isBlankFormValue and formatAttributeValue", () => {
  it("detects blanks", () => {
    expect(isBlankFormValue("  ")).toBe(true)
    expect(isBlankFormValue([])).toBe(true)
    expect(isBlankFormValue(false)).toBe(false)
    expect(isBlankFormValue(["a"])).toBe(false)
  })
  it("formats numbers with unit, and lists", () => {
    expect(formatAttributeValue({ type: "number", unit: "mm" }, 256, "en")).toBe("256 mm")
    expect(formatAttributeValue({ type: "number", unit: "mm" }, "0.02", "en")).toBe("0.02 mm")
    expect(formatAttributeValue({ type: "multiselect" }, ["PLA", "PETG"], "en")).toBe("PLA, PETG")
    expect(formatAttributeValue({ type: "text" }, null, "en")).toBe("")
  })
})

describe("untouchedStoredValue", () => {
  const number = { type: "number" } as const
  const multi = { type: "multiselect" } as const
  it("returns the stored raw value while the form value equals what loading produced", () => {
    expect(untouchedStoredValue(number, "1,000", "1,000")).toBe("1,000")
    expect(untouchedStoredValue(number, "256", 256)).toBe(256)
    expect(untouchedStoredValue(multi, ["PLA", "PETG"], "PLA, PETG")).toBe("PLA, PETG")
  })
  it("returns undefined once changed, or when nothing was stored", () => {
    expect(untouchedStoredValue(number, "1,001", "1,000")).toBeUndefined()
    expect(untouchedStoredValue(multi, ["PLA"], "PLA, PETG")).toBeUndefined()
    expect(untouchedStoredValue(number, "5", undefined)).toBeUndefined()
    expect(untouchedStoredValue(number, "", null)).toBeUndefined()
  })
})
