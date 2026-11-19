import { z } from "zod"

import {
  emptyFormValue,
  isBlankFormValue,
  normalizeNumberInput,
  toPayloadValue,
  type AttributeFormValue,
  type AttributePayloadValue,
} from "@/features/assets/lib/assetAttributeValues"

/** Guid-shaped id (API may seed non-RFC variant bits; do not use z.string().uuid()). */
export const guidLikeIdSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid id",
  )

export const ASSET_FAMILY_FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "boolean",
  "select",
  "multiselect",
  "url",
  "date",
] as const

export const assetFamilyFieldSchema = z.object({
  key: z.string().min(1),
  type: z.enum(ASSET_FAMILY_FIELD_TYPES).or(z.string()),
  required: z.boolean().default(false),
  label: z.string().nullish(),
  help: z.string().nullish(),
  unit: z.string().nullish(),
  min: z.number().nullish(),
  max: z.number().nullish(),
  decimals: z.number().int().nullish(),
  options: z.array(z.string()).nullish(),
  maxLength: z.number().int().nullish(),
  group: z.string().nullish(),
  archived: z.boolean().optional(),
})

export type AssetFamilyField = z.infer<typeof assetFamilyFieldSchema>

export const assetFamilySchema = z.object({
  id: guidLikeIdSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  fields: z
    .array(assetFamilyFieldSchema)
    .default([])
    .transform((fields) => fields.filter((field) => !field.archived)),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type AssetFamily = z.infer<typeof assetFamilySchema>

export const assetFamilyListSchema = z.array(assetFamilySchema)

const DEFAULT_TEXT_MAX_LENGTH = 500
const DEFAULT_LONGTEXT_MAX_LENGTH = 5000
const URL_MAX_LENGTH = 2048
const DEFAULT_DECIMALS = 6

function isValidIsoDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isHttpUrl(text: string): boolean {
  if (text.length > URL_MAX_LENGTH) return false
  try {
    const url = new URL(text)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function scaleOf(normalized: string): number {
  const fraction = normalized.split(".")[1]?.replace(/0+$/, "")
  return fraction?.length ?? 0
}

export type AttributeIssue = "required" | "invalid"

/**
 * Validates one control value against its field definition. Select and multiselect
 * membership is left to the API: values stored before an option list changed must
 * stay editable, and the controls only offer valid options.
 */
export function validateAttributeValue(
  field: AssetFamilyField,
  value: AttributeFormValue | undefined | null,
): AttributeIssue | null {
  if (field.type === "boolean") return null
  if (isBlankFormValue(value)) return field.required ? "required" : null

  if (field.type === "multiselect") {
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? null : "invalid"
  }
  if (typeof value !== "string") return "invalid"
  const text = value.trim()

  switch (field.type) {
    case "number": {
      const normalized = normalizeNumberInput(text)
      if (normalized === null) return "invalid"
      const number = Number(normalized)
      if (field.min != null && number < field.min) return "invalid"
      if (field.max != null && number > field.max) return "invalid"
      if (scaleOf(normalized) > (field.decimals ?? DEFAULT_DECIMALS)) return "invalid"
      return null
    }
    case "url":
      return isHttpUrl(text) ? null : "invalid"
    case "date":
      return isValidIsoDate(text) ? null : "invalid"
    case "longtext":
      return text.length <= (field.maxLength ?? DEFAULT_LONGTEXT_MAX_LENGTH) ? null : "invalid"
    case "text":
      return text.length <= (field.maxLength ?? DEFAULT_TEXT_MAX_LENGTH) ? null : "invalid"
    default:
      return null
  }
}

export function buildAttributesZodSchema(
  fields: readonly AssetFamilyField[],
  messages?: { required: string; invalid?: string },
) {
  const shape: Record<string, z.ZodTypeAny> = {}
  const requiredMessage = messages?.required ?? "Required"
  const invalidMessage = messages?.invalid ?? "Invalid value"

  for (const field of fields) {
    shape[field.key] = z.unknown().superRefine((value, ctx) => {
      const issue = validateAttributeValue(field, value as AttributeFormValue | undefined | null)
      if (issue) {
        ctx.addIssue({ code: "custom", message: issue === "required" ? requiredMessage : invalidMessage })
      }
    })
  }

  return z.object(shape)
}

export function emptyAttributesFromFields(
  fields: readonly AssetFamilyField[],
): Record<string, AttributeFormValue> {
  const values: Record<string, AttributeFormValue> = {}
  for (const field of fields) {
    values[field.key] = emptyFormValue(field)
  }
  return values
}

export function attributesToPayload(
  fields: readonly AssetFamilyField[],
  values: Record<string, AttributeFormValue | undefined> | undefined | null,
): Record<string, AttributePayloadValue> {
  const source = values ?? {}
  const payload: Record<string, AttributePayloadValue> = {}
  for (const field of fields) {
    payload[field.key] = toPayloadValue(field, source[field.key])
  }
  return payload
}
