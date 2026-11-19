import { describe, expect, it } from "vitest"

import {
  ASSET_FAMILY_KEY_PATTERN,
  adminAssetFamilyListSchema,
  adminAssetFamilySchemaPreviewSchema,
  adminAssetFamilyToFormValues,
  createAdminAssetFamilyFormSchema,
  emptyAdminAssetFamilyFormField,
  isSeedAssetFamilyKey,
  previewHasBlocking,
  previewNeedsConfirmation,
  toAdminAssetFamilySchemaPreviewRequest,
  toCreateAdminAssetFamilyRequest,
  toUpdateAdminAssetFamilyRequest,
  type AdminAssetFamily,
  type AdminAssetFamilyFormField,
} from "@/features/admin/schemas/adminAssetFamilySchemas"

const messages = {
  keyInvalid: "key",
  labelRequired: "label",
  labelMax: "label-max",
  sortOrderInvalid: "sort",
  fieldKeyRequired: "field-key",
  fieldKeyDuplicate: "duplicate",
  fieldKeyPattern: "field-pattern",
  seedActive: "seed",
  fieldLabelMax: "field-label-max",
  helpMax: "help-max",
  groupMax: "group-max",
  unitMax: "unit-max",
  numberInvalid: "number",
  minGreaterThanMax: "min-max",
  decimalsInvalid: "decimals",
  maxLengthInvalid: "max-length",
  optionsRequired: "options-required",
  optionsTooMany: "options-many",
  optionInvalid: "option-invalid",
  optionDuplicate: "option-duplicate",
  tooManyActive: "too-many-active",
  tooManyTotal: "too-many-total",
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
  schemaVersion: 4,
}

function formField(overrides: Partial<AdminAssetFamilyFormField>): AdminAssetFamilyFormField {
  return { ...emptyAdminAssetFamilyFormField(), key: "campo", ...overrides }
}

function parseFields(fields: AdminAssetFamilyFormField[]) {
  return schema.safeParse({
    key: "custom",
    label: "Custom",
    sortOrder: 0,
    isActive: true,
    fields,
  })
}

function messagesOf(result: ReturnType<typeof parseFields>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe("admin asset family form schema", () => {
  it("accepts a normalized key, label, and unique fields", () => {
    const parsed = schema.safeParse({
      key: "  Quadras_01 ",
      label: " Quadras ",
      sortOrder: 4,
      isActive: true,
      fields: [
        formField({ key: " area ", label: " Área " }),
        formField({ key: "covered", type: "boolean", required: true }),
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
        {
          key: "area", type: "text", required: false, label: "Área", help: null,
          unit: null, min: null, max: null, decimals: null, options: null,
          maxLength: null, group: null, archived: false,
        },
        {
          key: "covered", type: "boolean", required: true, label: null, help: null,
          unit: null, min: null, max: null, decimals: null, options: null,
          maxLength: null, group: null, archived: false,
        },
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

    const missingOrder = schema.safeParse({
      key: "quadras",
      label: "Quadras",
      sortOrder: Number.NaN,
      isActive: true,
      fields: [],
    })
    expect(missingOrder.success).toBe(false)
    if (!missingOrder.success) {
      expect(missingOrder.error.issues.every((issue) => issue.message === "sort")).toBe(
        true,
      )
    }
  })

  it("rejects duplicate field keys after trim and seed deactivation", () => {
    const duplicate = parseFields([
      formField({ key: "area" }),
      formField({ key: " area ", type: "number" }),
    ])
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

  it("applies the key pattern to new field rows only", () => {
    expect(messagesOf(parseFields([formField({ key: "Odd Key" })]))).toContain(
      "field-pattern",
    )
    expect(parseFields([formField({ key: "Odd Key", existing: true })]).success).toBe(true)
  })

  it("validates number properties: numeric text, min <= max and decimals 0..6", () => {
    expect(
      parseFields([
        formField({ type: "number", unit: "mm", min: "0", max: "10,5", decimals: "3" }),
      ]).success,
    ).toBe(true)
    expect(
      messagesOf(parseFields([formField({ type: "number", min: "abc" })])),
    ).toContain("number")
    expect(
      messagesOf(parseFields([formField({ type: "number", min: "5", max: "1" })])),
    ).toContain("min-max")
    expect(
      messagesOf(parseFields([formField({ type: "number", decimals: "7" })])),
    ).toContain("decimals")
    expect(
      messagesOf(parseFields([formField({ type: "number", unit: "x".repeat(17) })])),
    ).toContain("unit-max")
  })

  it("validates max length per text type", () => {
    expect(parseFields([formField({ type: "text", maxLength: "1000" })]).success).toBe(true)
    expect(
      messagesOf(parseFields([formField({ type: "text", maxLength: "1001" })])),
    ).toContain("max-length")
    expect(parseFields([formField({ type: "longtext", maxLength: "10000" })]).success).toBe(true)
    expect(
      messagesOf(parseFields([formField({ type: "longtext", maxLength: "0" })])),
    ).toContain("max-length")
  })

  it.each(["select", "multiselect"] as const)("validates the options of %s", (type) => {
    expect(parseFields([formField({ type, options: ["PLA", "PETG"] })]).success).toBe(true)
    expect(messagesOf(parseFields([formField({ type })]))).toContain("options-required")
    expect(
      messagesOf(parseFields([formField({ type, options: ["a, b"] })])),
    ).toContain("option-invalid")
    expect(
      messagesOf(parseFields([formField({ type, options: ["a", " "] })])),
    ).toContain("option-invalid")
    expect(
      messagesOf(parseFields([formField({ type, options: ["x".repeat(61)] })])),
    ).toContain("option-invalid")
    expect(
      messagesOf(parseFields([formField({ type, options: ["PLA", "pla"] })])),
    ).toContain("option-duplicate")
    expect(
      messagesOf(
        parseFields([
          formField({
            type,
            options: Array.from({ length: 51 }, (_, index) => `o${index}`),
          }),
        ]),
      ),
    ).toContain("options-many")
  })

  it("enforces 60 active and 200 total fields, archived fields not counting as active", () => {
    const active = (count: number) =>
      Array.from({ length: count }, (_, index) => formField({ key: `f${index}` }))
    const archived = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        formField({ key: `a${index}`, archived: true, existing: true }),
      )

    expect(parseFields([...active(60), ...archived(5)]).success).toBe(true)
    expect(messagesOf(parseFields(active(61)))).toContain("too-many-active")
    expect(messagesOf(parseFields([...active(60), ...archived(141)]))).toContain(
      "too-many-total",
    )
  })

  it("skips type rules for archived fields", () => {
    expect(
      parseFields([formField({ type: "select", options: [], archived: true, existing: true })])
        .success,
    ).toBe(true)
  })
})

describe("admin asset family request mapping", () => {
  it("keeps the key out of the update body and sends expectedSchemaVersion", () => {
    const values = adminAssetFamilyToFormValues(family)
    const request = toUpdateAdminAssetFamilyRequest(values, family.schemaVersion)

    expect(request).toEqual({
      label: "Espaços",
      sortOrder: 1,
      isActive: true,
      expectedSchemaVersion: 4,
      // Untouched fields go back exactly as received.
      fields: [{ key: "capacity", type: "number", required: true, label: "Capacidade" }],
    })
    expect(request).not.toHaveProperty("key")
    expect(isSeedAssetFamilyKey("spaces")).toBe(true)
    expect(isSeedAssetFamilyKey("quadras")).toBe(false)
  })

  it("round-trips every property of every type", () => {
    const fields = [
      { key: "name", type: "text", required: false, label: "Nome", help: "Ajuda", maxLength: 80, group: "Geral" },
      { key: "notes", type: "longtext", required: false, label: null, maxLength: 2000 },
      { key: "volume", type: "number", required: true, label: "Volume", unit: "mm", min: 0, max: 300.5, decimals: 1, group: "Volume" },
      { key: "covered", type: "boolean", required: false, label: null },
      { key: "size", type: "select", required: true, label: "Porte", options: ["P", "M", "G"] },
      { key: "materials", type: "multiselect", required: false, label: null, options: ["PLA", "PETG"] },
      { key: "site", type: "url", required: false, label: null, help: "Link técnico" },
      { key: "bought", type: "date", required: false, label: null },
    ] as const
    const parsed = adminAssetFamilyListSchema.parse([{ ...family, fields }])[0]!
    const values = adminAssetFamilyToFormValues(parsed)
    expect(toUpdateAdminAssetFamilyRequest(values, 4).fields).toEqual(fields)

    // Touch every field (label edit) so each is rebuilt from the form values.
    values.fields = values.fields.map((field) => ({ ...field, label: `${field.label}!` }))
    const request = toUpdateAdminAssetFamilyRequest(values, 4)

    expect(request.fields).toEqual([
      expect.objectContaining({ key: "name", type: "text", help: "Ajuda", maxLength: 80, group: "Geral", unit: null, options: null }),
      expect.objectContaining({ key: "notes", type: "longtext", maxLength: 2000 }),
      expect.objectContaining({ key: "volume", type: "number", required: true, unit: "mm", min: 0, max: 300.5, decimals: 1, group: "Volume", maxLength: null }),
      expect.objectContaining({ key: "covered", type: "boolean" }),
      expect.objectContaining({ key: "size", type: "select", required: true, options: ["P", "M", "G"] }),
      expect.objectContaining({ key: "materials", type: "multiselect", options: ["PLA", "PETG"] }),
      expect.objectContaining({ key: "site", type: "url", help: "Link técnico" }),
      expect.objectContaining({ key: "bought", type: "date" }),
    ])
    expect(schema.safeParse(values).success).toBe(true)
    expect(values.fields.every((field) => field.existing)).toBe(true)
  })

  it("drops properties that do not apply after a type switch", () => {
    const request = toCreateAdminAssetFamilyRequest({
      key: "custom",
      label: "Custom",
      sortOrder: 0,
      isActive: true,
      fields: [
        formField({
          type: "boolean",
          unit: "mm",
          min: "1",
          max: "2",
          decimals: "2",
          maxLength: "10",
          options: ["a"],
        }),
      ],
    })

    expect(request.fields[0]).toMatchObject({
      unit: null, min: null, max: null, decimals: null, maxLength: null, options: null,
    })
  })

  it("normalizes a decimal comma and trims options", () => {
    const [field] = toCreateAdminAssetFamilyRequest({
      key: "custom",
      label: "Custom",
      sortOrder: 0,
      isActive: true,
      fields: [formField({ type: "number", min: "0,5", max: "9" })],
    }).fields
    expect(field).toMatchObject({ min: 0.5, max: 9 })

    const [select] = toCreateAdminAssetFamilyRequest({
      key: "custom",
      label: "Custom",
      sortOrder: 0,
      isActive: true,
      fields: [formField({ type: "select", options: [" PLA ", "ABS"] })],
    }).fields
    expect(select?.options).toEqual(["PLA", "ABS"])
  })

  it("sends archived fields back explicitly, in stored order, and clears required", () => {
    const parsed = adminAssetFamilyListSchema.parse([
      {
        ...family,
        fields: [
          { key: "old", type: "text", required: true, label: "Antigo", archived: true },
          { key: "capacity", type: "number", required: false, label: "Capacidade" },
        ],
      },
    ])[0]!
    const values = adminAssetFamilyToFormValues(parsed)

    expect(values.fields.map((field) => field.key)).toEqual(["old", "capacity"])

    // Untouched archived field goes back verbatim.
    expect(toUpdateAdminAssetFamilyRequest(values, 4).fields[0]).toEqual(parsed.fields[0])

    // Restore sends archived false; archiving another field sends required false.
    values.fields[0] = { ...values.fields[0]!, archived: false }
    expect(toUpdateAdminAssetFamilyRequest(values, 4).fields[0]).toMatchObject({
      key: "old",
      archived: false,
    })
    values.fields[1] = { ...values.fields[1]!, archived: true, required: false }
    expect(toUpdateAdminAssetFamilyRequest(values, 4).fields[1]).toMatchObject({
      key: "capacity",
      archived: true,
      required: false,
    })
  })

  it("keeps an unknown field type and its properties unchanged, even when archived", () => {
    const parsed = adminAssetFamilyListSchema.parse([
      {
        ...family,
        fields: [
          { key: "geo", type: "geopoint", required: true, label: "Local", help: "h", unit: "deg" },
        ],
      },
    ])[0]!
    const values = adminAssetFamilyToFormValues(parsed)

    expect(values.fields[0]?.type).toBe("geopoint")
    expect(schema.safeParse(values).success).toBe(true)
    expect(toUpdateAdminAssetFamilyRequest(values, 4).fields[0]).toEqual(parsed.fields[0])

    values.fields[0] = { ...values.fields[0]!, label: "Mudou", archived: true }
    expect(toUpdateAdminAssetFamilyRequest(values, 4).fields[0]).toEqual({
      ...parsed.fields[0],
      archived: true,
      required: false,
    })
  })

  it("builds the preview request from the same field mapping", () => {
    const values = adminAssetFamilyToFormValues(family)
    expect(toAdminAssetFamilySchemaPreviewRequest(values).fields).toEqual(
      toUpdateAdminAssetFamilyRequest(values, 4).fields,
    )
  })
})

describe("admin asset family response schema", () => {
  it("parses the detail list, defaults schemaVersion and tolerates an unknown type", () => {
    const withoutVersion: Record<string, unknown> = { ...family }
    delete withoutVersion.schemaVersion
    const parsed = adminAssetFamilyListSchema.parse([withoutVersion])
    expect(parsed[0]?.schemaVersion).toBe(1)
    expect(
      adminAssetFamilyListSchema.safeParse([
        { ...family, fields: [{ key: "x", type: "future", required: false, label: null }] },
      ]).success,
    ).toBe(true)
  })
})

describe("schema preview", () => {
  const row = (overrides: Record<string, unknown>) => ({
    key: "materials",
    change: "updated",
    assetCount: 0,
    tenantCount: 0,
    incompatibleCount: 0,
    incompatibleSamples: [],
    constraintViolationCount: 0,
    blocking: false,
    ...overrides,
  })
  const preview = (fields: Record<string, unknown>[], canSave = true) =>
    adminAssetFamilySchemaPreviewSchema.parse({
      schemaVersion: 4,
      assetCount: 3,
      tenantCount: 2,
      canSave,
      fields,
    })

  it("detects blocking rows and a canSave of false", () => {
    expect(previewHasBlocking(preview([row({})]))).toBe(false)
    expect(previewHasBlocking(preview([row({ blocking: true })]))).toBe(true)
    expect(previewHasBlocking(preview([row({})], false))).toBe(true)
  })

  it("asks for confirmation on archive, removal, type change and constraint warnings only", () => {
    expect(previewNeedsConfirmation(preview([row({ change: "added" })]))).toBe(false)
    expect(previewNeedsConfirmation(preview([row({ change: "updated" })]))).toBe(false)
    expect(previewNeedsConfirmation(preview([row({ change: "archived" })]))).toBe(true)
    expect(previewNeedsConfirmation(preview([row({ change: "removed" })]))).toBe(true)
    expect(previewNeedsConfirmation(preview([row({ change: "typeChanged" })]))).toBe(true)
    expect(
      previewNeedsConfirmation(preview([row({ constraintViolationCount: 2 })])),
    ).toBe(true)
  })

  it("tolerates null samples and fields", () => {
    const parsed = adminAssetFamilySchemaPreviewSchema.parse({
      schemaVersion: 1,
      assetCount: 0,
      tenantCount: 0,
      canSave: true,
      fields: null,
    })
    expect(parsed.fields).toEqual([])
    expect(preview([row({ incompatibleSamples: null })]).fields[0]?.incompatibleSamples).toEqual([])
  })
})
