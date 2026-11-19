import { describe, expect, it } from "vitest"

import { attributeToInputString } from "@/features/assets/lib/assetAttributeValues"
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
