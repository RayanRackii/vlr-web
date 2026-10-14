import { z } from "zod"

import { guidLikeIdSchema } from "@/features/assets/schemas/assetFamilySchemas"

/** Seeds locked by the API: cannot be deleted or deactivated. */
export const SEED_ASSET_FAMILY_KEYS = [
  "spaces",
  "electrical",
  "goods",
  "generic",
] as const

export const ASSET_FAMILY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/

const ASSET_FAMILY_FIELD_TYPES = ["text", "number", "boolean"] as const

const INT32_MIN = -2147483648
const INT32_MAX = 2147483647

export const assetFamilyFieldTypeSchema = z.enum(ASSET_FAMILY_FIELD_TYPES)

export type AssetFamilyFieldType = z.infer<typeof assetFamilyFieldTypeSchema>

export function isSeedAssetFamilyKey(key: string): boolean {
  return (SEED_ASSET_FAMILY_KEYS as readonly string[]).includes(key)
}

export const adminAssetFamilyFieldSchema = z.object({
  key: z.string().min(1),
  type: assetFamilyFieldTypeSchema,
  required: z.boolean(),
  label: z.string().nullish(),
})

export type AdminAssetFamilyField = z.infer<typeof adminAssetFamilyFieldSchema>

export const adminAssetFamilySchema = z.object({
  id: guidLikeIdSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  fields: z.array(adminAssetFamilyFieldSchema).default([]),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type AdminAssetFamily = z.infer<typeof adminAssetFamilySchema>

export const adminAssetFamilyListSchema = z.array(adminAssetFamilySchema)

export type AdminAssetFamilyFieldInput = {
  key: string
  type: AssetFamilyFieldType
  required: boolean
  label: string | null
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
}

export function createAdminAssetFamilyFormSchema(messages: {
  keyInvalid: string
  labelRequired: string
  labelMax: string
  sortOrderInvalid: string
  fieldKeyRequired: string
  fieldKeyDuplicate: string
  seedActive: string
}) {
  const fieldSchema = z.object({
    key: z.string().trim().min(1, messages.fieldKeyRequired),
    type: assetFamilyFieldTypeSchema,
    required: z.boolean(),
    label: z.string(),
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
        .number()
        .int(messages.sortOrderInvalid)
        .min(INT32_MIN, messages.sortOrderInvalid)
        .max(INT32_MAX, messages.sortOrderInvalid),
      isActive: z.boolean(),
      fields: z.array(fieldSchema),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>()

      value.fields.forEach((field, index) => {
        if (seen.has(field.key)) {
          ctx.addIssue({
            code: "custom",
            path: ["fields", index, "key"],
            message: messages.fieldKeyDuplicate,
          })
          return
        }

        seen.add(field.key)
      })

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

export const emptyAdminAssetFamilyFormValues: AdminAssetFamilyFormValues = {
  key: "",
  label: "",
  sortOrder: 0,
  isActive: true,
  fields: [],
}

export function adminAssetFamilyToFormValues(
  family: AdminAssetFamily,
): AdminAssetFamilyFormValues {
  return {
    key: family.key,
    label: family.label,
    sortOrder: family.sortOrder,
    isActive: family.isActive,
    fields: family.fields.map((field) => ({
      key: field.key,
      type: field.type,
      required: field.required,
      label: field.label ?? "",
    })),
  }
}

function toFieldInput(
  field: AdminAssetFamilyFormValues["fields"][number],
): AdminAssetFamilyFieldInput {
  const label = field.label.trim()

  return {
    key: field.key.trim(),
    type: field.type,
    required: field.required,
    label: label.length > 0 ? label : null,
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
): UpdateAdminAssetFamilyRequest {
  return {
    label: values.label.trim(),
    fields: values.fields.map(toFieldInput),
    sortOrder: values.sortOrder,
    isActive: values.isActive,
  }
}
