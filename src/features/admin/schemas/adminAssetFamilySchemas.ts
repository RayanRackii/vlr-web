import { z } from "zod"

import {
  ASSET_FAMILY_FIELD_TYPES,
  guidLikeIdSchema,
} from "@/features/assets/schemas/assetFamilySchemas"

/** Seeds locked by the API: cannot be deleted or deactivated. */
export const SEED_ASSET_FAMILY_KEYS = [
  "spaces",
  "electrical",
  "goods",
  "generic",
] as const

export const ASSET_FAMILY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/

export const MAX_ACTIVE_FIELDS = 60
export const MAX_TOTAL_FIELDS = 200
const MAX_OPTIONS = 50
const MAX_OPTION_LENGTH = 60
const TYPES_WITH_OPTIONS: readonly string[] = ["select", "multiselect"]
const NUMERIC_TEXT = /^-?\d+([.,]\d+)?$/

const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

export const assetFamilyFieldTypeSchema = z.enum(ASSET_FAMILY_FIELD_TYPES)

export type AssetFamilyFieldType = z.infer<typeof assetFamilyFieldTypeSchema>

export function isSeedAssetFamilyKey(key: string): boolean {
  return (SEED_ASSET_FAMILY_KEYS as readonly string[]).includes(key)
}

export const adminAssetFamilyFieldSchema = z.object({
  key: z.string().min(1),
  // Tolerant: an unknown type must not crash the admin list.
  type: assetFamilyFieldTypeSchema.or(z.string()),
  required: z.boolean(),
  label: z.string().nullish(),
  help: z.string().nullish(),
  unit: z.string().nullish(),
  min: z.number().nullish(),
  max: z.number().nullish(),
  decimals: z.number().int().nullish(),
  options: z.array(z.string()).nullish(),
  maxLength: z.number().int().nullish(),
  group: z.string().nullish(),
  archived: z.boolean().nullish(),
})

export type AdminAssetFamilyField = z.infer<typeof adminAssetFamilyFieldSchema>

export const adminAssetFamilySchema = z.object({
  id: guidLikeIdSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  fields: z.array(adminAssetFamilyFieldSchema).default([]),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  schemaVersion: z.number().int().default(1),
})

export type AdminAssetFamily = z.infer<typeof adminAssetFamilySchema>

export const adminAssetFamilyListSchema = z.array(adminAssetFamilySchema)

export type AdminAssetFamilyFieldInput = {
  key: string
  type: AssetFamilyFieldType
  required: boolean
  label: string | null
  help: string | null
  unit: string | null
  min: number | null
  max: number | null
  decimals: number | null
  options: string[] | null
  maxLength: number | null
  group: string | null
  archived: boolean
}

export type CreateAdminAssetFamilyRequest = {
  key: string
  label: string
  fields: AdminAssetFamilyFieldInput[]
  sortOrder: number
  isActive: boolean
}

export type UpdateAdminAssetFamilyRequest = {
  label: string
  fields: AdminAssetFamilyFieldInput[]
  sortOrder: number
  isActive: boolean
  expectedSchemaVersion?: number
}

export type AdminAssetFamilySchemaPreviewRequest = {
  fields: AdminAssetFamilyFieldInput[]
}

export const adminAssetFamilyFieldImpactSchema = z.object({
  key: z.string(),
  change: z.string(),
  assetCount: z.number().int().default(0),
  tenantCount: z.number().int().default(0),
  incompatibleCount: z.number().int().default(0),
  incompatibleSamples: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  constraintViolationCount: z.number().int().default(0),
  blocking: z.boolean().default(false),
})

export type AdminAssetFamilyFieldImpact = z.infer<
  typeof adminAssetFamilyFieldImpactSchema
>

export const adminAssetFamilySchemaPreviewSchema = z.object({
  schemaVersion: z.number().int().default(1),
  assetCount: z.number().int().default(0),
  tenantCount: z.number().int().default(0),
  canSave: z.boolean(),
  fields: z
    .array(adminAssetFamilyFieldImpactSchema)
    .nullish()
    .transform((value) => value ?? []),
})

export type AdminAssetFamilySchemaPreview = z.infer<
  typeof adminAssetFamilySchemaPreviewSchema
>

/** Changes that need an explicit confirmation before the update is sent. */
const CONFIRM_CHANGES: readonly string[] = ["archived", "removed", "typeChanged"]

export function previewHasBlocking(preview: AdminAssetFamilySchemaPreview): boolean {
  return !preview.canSave || preview.fields.some((row) => row.blocking)
}

/** A row the admin should read before saving: archived, removed, retyped or with constraint warnings. */
export function isAttentionRow(row: AdminAssetFamilyFieldImpact): boolean {
  return CONFIRM_CHANGES.includes(row.change) || row.constraintViolationCount > 0
}

export function previewNeedsConfirmation(
  preview: AdminAssetFamilySchemaPreview,
): boolean {
  return preview.fields.some(isAttentionRow)
}

export type AdminAssetFamilyFormMessages = {
  keyInvalid: string
  labelRequired: string
  labelMax: string
  sortOrderInvalid: string
  fieldKeyRequired: string
  fieldKeyDuplicate: string
  fieldKeyPattern: string
  seedActive: string
  fieldLabelMax: string
  helpMax: string
  groupMax: string
  unitMax: string
  numberInvalid: string
  minGreaterThanMax: string
  decimalsInvalid: string
  maxLengthInvalid: string
  optionsRequired: string
  optionsTooMany: string
  optionInvalid: string
  optionDuplicate: string
  tooManyActive: string
  tooManyTotal: string
}

function parseNumberText(text: string): number | null {
  const trimmed = text.trim()
  if (!NUMERIC_TEXT.test(trimmed)) {
    return null
  }

  return Number(trimmed.replace(",", "."))
}

export function createAdminAssetFamilyFormSchema(
  messages: AdminAssetFamilyFormMessages,
) {
  const fieldSchema = z.object({
    key: z.string().trim().min(1, messages.fieldKeyRequired),
    type: assetFamilyFieldTypeSchema,
    required: z.boolean(),
    label: z.string().max(120, messages.fieldLabelMax),
    help: z.string().max(300, messages.helpMax),
    group: z.string().max(60, messages.groupMax),
    unit: z.string().max(16, messages.unitMax),
    min: z.string(),
    max: z.string(),
    decimals: z.string(),
    maxLength: z.string(),
    options: z.array(z.string()),
    archived: z.boolean(),
    /** True when the field already exists on the server: its key is locked. */
    existing: z.boolean(),
  })

  return z
    .object({
      key: z
        .string()
        .trim()
        .toLowerCase()
        .regex(ASSET_FAMILY_KEY_PATTERN, messages.keyInvalid),
      label: z
        .string()
        .trim()
        .min(1, messages.labelRequired)
        .max(200, messages.labelMax),
      sortOrder: z
        .number({ error: messages.sortOrderInvalid })
        .int(messages.sortOrderInvalid)
        .min(INT32_MIN, messages.sortOrderInvalid)
        .max(INT32_MAX, messages.sortOrderInvalid),
      isActive: z.boolean(),
      fields: z.array(fieldSchema),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>()
      const issue = (index: number, name: string, message: string) => {
        ctx.addIssue({ code: "custom", path: ["fields", index, name], message })
      }

      value.fields.forEach((field, index) => {
        const key = field.key.trim()

        if (seen.has(key)) {
          issue(index, "key", messages.fieldKeyDuplicate)
        } else {
          seen.add(key)
        }

        if (key !== "" && !field.existing && !ASSET_FAMILY_KEY_PATTERN.test(key)) {
          issue(index, "key", messages.fieldKeyPattern)
        }

        if (field.archived) {
          return
        }

        if (field.type === "number") {
          const min = field.min.trim() === "" ? null : parseNumberText(field.min)
          const max = field.max.trim() === "" ? null : parseNumberText(field.max)

          if (field.min.trim() !== "" && min === null) {
            issue(index, "min", messages.numberInvalid)
          }
          if (field.max.trim() !== "" && max === null) {
            issue(index, "max", messages.numberInvalid)
          }
          if (min !== null && max !== null && min > max) {
            issue(index, "max", messages.minGreaterThanMax)
          }
          if (field.decimals.trim() !== "") {
            const decimals = Number(field.decimals)
            if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
              issue(index, "decimals", messages.decimalsInvalid)
            }
          }
        }

        if (
          (field.type === "text" || field.type === "longtext")
          && field.maxLength.trim() !== ""
        ) {
          const limit = field.type === "text" ? 1000 : 10000
          const length = Number(field.maxLength)
          if (!Number.isInteger(length) || length < 1 || length > limit) {
            issue(index, "maxLength", messages.maxLengthInvalid)
          }
        }

        if (TYPES_WITH_OPTIONS.includes(field.type)) {
          const options = field.options.map((option) => option.trim())
          if (options.length === 0) {
            issue(index, "options", messages.optionsRequired)
          } else if (options.length > MAX_OPTIONS) {
            issue(index, "options", messages.optionsTooMany)
          } else if (
            options.some(
              (option) =>
                option === ""
                || option.length > MAX_OPTION_LENGTH
                || option.includes(","),
            )
          ) {
            issue(index, "options", messages.optionInvalid)
          } else if (
            new Set(options.map((option) => option.toLowerCase())).size
            !== options.length
          ) {
            issue(index, "options", messages.optionDuplicate)
          }
        }
      })

      const active = value.fields.filter((field) => !field.archived).length
      if (active > MAX_ACTIVE_FIELDS) {
        ctx.addIssue({
          code: "custom",
          path: ["fields"],
          message: messages.tooManyActive,
        })
      }
      if (value.fields.length > MAX_TOTAL_FIELDS) {
        ctx.addIssue({
          code: "custom",
          path: ["fields"],
          message: messages.tooManyTotal,
        })
      }

      if (!value.isActive && isSeedAssetFamilyKey(value.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["isActive"],
          message: messages.seedActive,
        })
      }
    })
}

export type AdminAssetFamilyFormValues = z.infer<
  ReturnType<typeof createAdminAssetFamilyFormSchema>
>

export type AdminAssetFamilyFormField = AdminAssetFamilyFormValues["fields"][number]

export const emptyAdminAssetFamilyFormValues: AdminAssetFamilyFormValues = {
  key: "",
  label: "",
  sortOrder: 0,
  isActive: true,
  fields: [],
}

export function emptyAdminAssetFamilyFormField(): AdminAssetFamilyFormField {
  return {
    key: "",
    label: "",
    type: "text",
    required: false,
    help: "",
    group: "",
    unit: "",
    min: "",
    max: "",
    decimals: "",
    maxLength: "",
    options: [],
    archived: false,
    existing: false,
  }
}

function numberToText(value: number | null | undefined): string {
  return value == null ? "" : String(value)
}

export function adminAssetFamilyToFormValues(
  family: AdminAssetFamily,
): AdminAssetFamilyFormValues {
  return {
    key: family.key,
    label: family.label,
    sortOrder: family.sortOrder,
    isActive: family.isActive,
    // Active fields first, archived fields at the end (the API appends them too).
    fields: [
      ...family.fields.filter((field) => field.archived !== true),
      ...family.fields.filter((field) => field.archived === true),
    ].map((field) => ({
      key: field.key,
      type: assetFamilyFieldTypeSchema.catch("text").parse(field.type),
      required: field.required,
      label: field.label ?? "",
      help: field.help ?? "",
      group: field.group ?? "",
      unit: field.unit ?? "",
      min: numberToText(field.min),
      max: numberToText(field.max),
      decimals: numberToText(field.decimals),
      maxLength: numberToText(field.maxLength),
      options: [...(field.options ?? [])],
      archived: field.archived === true,
      existing: true,
    })),
  }
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function numberOrNull(value: string): number | null {
  return value.trim() === "" ? null : parseNumberText(value)
}

/** Properties that do not apply to the type are sent as null so a type switch leaves nothing behind. */
export function toFieldInput(
  field: AdminAssetFamilyFormField,
): AdminAssetFamilyFieldInput {
  const isNumber = field.type === "number"
  const isText = field.type === "text" || field.type === "longtext"
  const hasOptions = TYPES_WITH_OPTIONS.includes(field.type)

  return {
    key: field.key.trim(),
    type: field.type,
    required: field.archived ? false : field.required,
    label: textOrNull(field.label),
    help: textOrNull(field.help),
    unit: isNumber ? textOrNull(field.unit) : null,
    min: isNumber ? numberOrNull(field.min) : null,
    max: isNumber ? numberOrNull(field.max) : null,
    decimals: isNumber ? numberOrNull(field.decimals) : null,
    options: hasOptions ? field.options.map((option) => option.trim()) : null,
    maxLength: isText ? numberOrNull(field.maxLength) : null,
    group: textOrNull(field.group),
    archived: field.archived,
  }
}

export function toCreateAdminAssetFamilyRequest(
  values: AdminAssetFamilyFormValues,
): CreateAdminAssetFamilyRequest {
  return {
    key: values.key.trim().toLowerCase(),
    label: values.label.trim(),
    fields: values.fields.map(toFieldInput),
    sortOrder: values.sortOrder,
    isActive: values.isActive,
  }
}

export function toUpdateAdminAssetFamilyRequest(
  values: AdminAssetFamilyFormValues,
  expectedSchemaVersion?: number,
): UpdateAdminAssetFamilyRequest {
  return {
    label: values.label.trim(),
    fields: values.fields.map(toFieldInput),
    sortOrder: values.sortOrder,
    isActive: values.isActive,
    ...(expectedSchemaVersion === undefined ? {} : { expectedSchemaVersion }),
  }
}

export function toAdminAssetFamilySchemaPreviewRequest(
  values: AdminAssetFamilyFormValues,
): AdminAssetFamilySchemaPreviewRequest {
  return { fields: values.fields.map(toFieldInput) }
}
