import { describe, expect, it } from "vitest"

import {
  attributesToPayload,
  buildAttributesZodSchema,
  emptyAttributesFromFields,
  validateAttributeValue,
  type AssetFamilyField,
} from "@/features/assets/schemas/assetFamilySchemas"

const field = (partial: Partial<AssetFamilyField> & Pick<AssetFamilyField, "key" | "type">): AssetFamilyField => ({
  required: false,
  ...partial,
})

describe("validateAttributeValue", () => {
  it("number: normalizes comma, rejects thousands separators, applies min/max/decimals", () => {
    const f = field({ key: "n", type: "number", min: 0, max: 10, decimals: 2 })
    expect(validateAttributeValue(f, "0,02")).toBeNull()
    expect(validateAttributeValue(f, "1.234,5")).toBe("invalid")
    expect(validateAttributeValue(f, "-1")).toBe("invalid")
    expect(validateAttributeValue(f, "11")).toBe("invalid")
    expect(validateAttributeValue(f, "1.234")).toBe("invalid")
    expect(validateAttributeValue(f, "1.230")).toBeNull()
    expect(validateAttributeValue(f, "")).toBeNull()
  })

  it("required: blank string, empty array and missing are required; boolean never is", () => {
    expect(validateAttributeValue(field({ key: "a", type: "text", required: true }), "  ")).toBe("required")
    expect(validateAttributeValue(field({ key: "a", type: "multiselect", required: true, options: ["x"] }), [])).toBe("required")
    expect(validateAttributeValue(field({ key: "a", type: "number", required: true }), undefined)).toBe("required")
    expect(validateAttributeValue(field({ key: "a", type: "boolean", required: true }), false)).toBeNull()
  })

  it("url, date, text and longtext limits", () => {
    expect(validateAttributeValue(field({ key: "u", type: "url" }), "https://x.y/z")).toBeNull()
    expect(validateAttributeValue(field({ key: "u", type: "url" }), "ftp://x.y")).toBe("invalid")
    expect(validateAttributeValue(field({ key: "u", type: "url" }), "javascript:alert(1)")).toBe("invalid")
    expect(validateAttributeValue(field({ key: "d", type: "date" }), "2026-11-19")).toBeNull()
    expect(validateAttributeValue(field({ key: "d", type: "date" }), "2026-02-30")).toBe("invalid")
    expect(validateAttributeValue(field({ key: "d", type: "date" }), "19/11/2026")).toBe("invalid")
    expect(validateAttributeValue(field({ key: "t", type: "text", maxLength: 3 }), "abcd")).toBe("invalid")
    expect(validateAttributeValue(field({ key: "l", type: "longtext" }), "x".repeat(5001))).toBe("invalid")
    expect(validateAttributeValue(field({ key: "l", type: "longtext" }), "linha 1\nlinha 2")).toBeNull()
  })

  it("multiselect tolerates legacy tokens outside the option list", () => {
    const f = field({ key: "m", type: "multiselect", options: ["PLA"] })
    expect(validateAttributeValue(f, ["PLA", "PLA especial"])).toBeNull()
  })
})

describe("buildAttributesZodSchema", () => {
  const fields = [
    field({ key: "cap", type: "number", required: true }),
    field({ key: "mat", type: "multiselect", options: ["PLA"] }),
  ]

  it("reports required and invalid with the given messages", () => {
    const schema = buildAttributesZodSchema(fields, { required: "REQ", invalid: "BAD" })
    const blank = schema.safeParse({ cap: "", mat: [] })
    expect(blank.success).toBe(false)
    expect(blank.error?.issues.map((issue) => [issue.path[0], issue.message])).toEqual([["cap", "REQ"]])
    const bad = schema.safeParse({ cap: "abc", mat: [] })
    expect(bad.error?.issues.map((issue) => issue.message)).toEqual(["BAD"])
    expect(schema.safeParse({ cap: "12", mat: ["PLA"] }).success).toBe(true)
  })
})

describe("emptyAttributesFromFields and attributesToPayload", () => {
  const fields = [
    field({ key: "t", type: "text" }),
    field({ key: "n", type: "number" }),
    field({ key: "b", type: "boolean" }),
    field({ key: "m", type: "multiselect", options: ["PLA"] }),
  ]

  it("builds typed empty values", () => {
    expect(emptyAttributesFromFields(fields)).toEqual({ t: "", n: "", b: false, m: [] })
  })

  it("builds a typed payload: number as number, boolean as boolean, multiselect as array", () => {
    expect(attributesToPayload(fields, { t: " x ", n: "0,5", b: true, m: ["PLA"] })).toEqual({
      t: "x",
      n: 0.5,
      b: true,
      m: ["PLA"],
    })
    expect(attributesToPayload(fields, emptyAttributesFromFields(fields))).toEqual({
      t: null,
      n: null,
      b: false,
      m: null,
    })
  })
})

describe("untouched stored values", () => {
  const fields = [
    field({ key: "n", type: "number", min: 0, max: 10, decimals: 1 }),
    field({ key: "u", type: "url" }),
    field({ key: "t", type: "text", maxLength: 3 }),
    field({ key: "m", type: "multiselect", options: ["PLA"] }),
  ]
  const stored = { n: "12 mm", u: "ftp://old", t: "abcdef", m: "PLA especial, PLA" }
  const form = { n: "12 mm", u: "ftp://old", t: "abcdef", m: ["PLA especial", "PLA"] }

  it.each([
    ["n", "12 mm"],
    ["n", "1.234,5"],
    ["n", "99"],
    ["n", "1.2345"],
    ["u", "ftp://old"],
    ["t", "abcdef"],
  ])("does not block an untouched %s value %s, but blocks it once edited", (key, raw) => {
    const f = fields.find((candidate) => candidate.key === key)!
    expect(validateAttributeValue(f, raw)).toBe("invalid")
    expect(validateAttributeValue(f, raw, raw)).toBeNull()
    expect(validateAttributeValue(f, raw + "x", raw)).toBe("invalid")
  })

  it("validates the schema skipping untouched fields only", () => {
    const schema = buildAttributesZodSchema(fields, undefined, stored)
    expect(schema.safeParse(form).success).toBe(true)
    expect(schema.safeParse({ ...form, n: "99" }).success).toBe(false)
  })

  it("keeps the required rule for blank values", () => {
    const required = field({ key: "r", type: "text", required: true })
    expect(validateAttributeValue(required, "", "x")).toBe("required")
  })

  it("re-sends untouched values exactly as stored and normalizes only changed ones", () => {
    const payload = attributesToPayload(fields, { ...form, n: "0,5" }, stored)
    expect(payload).toEqual({ n: 0.5, u: "ftp://old", t: "abcdef", m: "PLA especial, PLA" })
    expect(attributesToPayload([fields[0]!], { n: "1,000" }, { n: "1,000" })).toEqual({ n: "1,000" })
  })
})
