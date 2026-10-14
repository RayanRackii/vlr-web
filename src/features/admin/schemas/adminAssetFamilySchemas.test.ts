import { describe, expect, it } from "vitest"

import {
  ASSET_FAMILY_KEY_PATTERN,
  adminAssetFamilyListSchema,
  adminAssetFamilyToFormValues,
  createAdminAssetFamilyFormSchema,
  isSeedAssetFamilyKey,
  toCreateAdminAssetFamilyRequest,
  toUpdateAdminAssetFamilyRequest,
  type AdminAssetFamily,
} from "@/features/admin/schemas/adminAssetFamilySchemas"

const messages = {
  keyInvalid: "key",
  labelRequired: "label",
  labelMax: "label-max",
  sortOrderInvalid: "sort",
  fieldKeyRequired: "field-key",
  fieldKeyDuplicate: "duplicate",
  seedActive: "seed",
}

const schema = createAdminAssetFamilyFormSchema(messages)

const family: AdminAssetFamily = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "spaces",
  label: "Espaços",
  fields: [
    { key: "capacity", type: "number", required: true, label: "Capacidade" },
  ],
  sortOrder: 1,
  isActive: true,
}

describe("admin asset family form schema", () => {
  it("accepts a normalized key, label, and unique fields", () => {
    const parsed = schema.safeParse({
      key: "  Quadras_01 ",
      label: " Quadras ",
      sortOrder: 4,
      isActive: true,
      fields: [
        { key: " area ", label: " Área ", type: "text", required: false },
        { key: "covered", label: "", type: "boolean", required: true },
      ],
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      return
    }

    expect(parsed.data.key).toBe("quadras_01")
    expect(parsed.data.label).toBe("Quadras")
    expect(parsed.data.fields[0]?.key).toBe("area")
    expect(toCreateAdminAssetFamilyRequest(parsed.data)).toEqual({
      key: "quadras_01",
      label: "Quadras",
      sortOrder: 4,
      isActive: true,
      fields: [
        { key: "area", type: "text", required: false, label: "Área" },
        { key: "covered", type: "boolean", required: true, label: null },
      ],
    })
  })

  it("rejects a key the API would reject and a label over 200", () => {
    expect(schema.safeParse({
      key: "1quadra",
      label: "Quadras",
      sortOrder: 0,
      isActive: true,
      fields: [],
    }).success).toBe(false)

    expect(ASSET_FAMILY_KEY_PATTERN.test("a".repeat(64))).toBe(true)
    expect(ASSET_FAMILY_KEY_PATTERN.test("a".repeat(65))).toBe(false)

    const longLabel = schema.safeParse({
      key: "quadras",
      label: "x".repeat(201),
      sortOrder: 0,
      isActive: true,
      fields: [],
    })
    expect(longLabel.success).toBe(false)
  })

  it("rejects duplicate field keys after trim and seed deactivation", () => {
    const duplicate = schema.safeParse({
      key: "custom",
      label: "Custom",
      sortOrder: 0,
      isActive: true,
      fields: [
        { key: "area", label: "", type: "text", required: false },
        { key: " area ", label: "", type: "number", required: false },
      ],
    })
    expect(duplicate.success).toBe(false)

    const seed = schema.safeParse({
      key: "Electrical",
      label: "Elétricos",
      sortOrder: 2,
      isActive: false,
      fields: [],
    })
    expect(seed.success).toBe(false)
    if (seed.success) {
      return
    }

    expect(seed.error.issues.some((issue) => issue.message === "seed")).toBe(true)
  })

  it("keeps the key out of the update body", () => {
    const values = adminAssetFamilyToFormValues(family)
    expect(toUpdateAdminAssetFamilyRequest(values)).toEqual({
      label: "Espaços",
      sortOrder: 1,
      isActive: true,
      fields: [
        { key: "capacity", type: "number", required: true, label: "Capacidade" },
      ],
    })
    expect(isSeedAssetFamilyKey("spaces")).toBe(true)
    expect(isSeedAssetFamilyKey("quadras")).toBe(false)
  })
})

describe("admin asset family response schema", () => {
  it("parses the detail list and rejects an unknown field type", () => {
    expect(adminAssetFamilyListSchema.safeParse([family]).success).toBe(true)
    expect(
      adminAssetFamilyListSchema.safeParse([
        { ...family, fields: [{ key: "x", type: "date", required: false, label: null }] },
      ]).success,
    ).toBe(false)
  })
})
