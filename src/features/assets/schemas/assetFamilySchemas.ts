import { z } from "zod"

/** Guid-shaped id (API may seed non-RFC variant bits; do not use z.string().uuid()). */
const guidLikeSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid id",
  )

export const assetFamilyFieldSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["text", "number", "boolean"]).or(z.string()),
  required: z.boolean().default(false),
  label: z.string().nullish(),
})

export type AssetFamilyField = z.infer<typeof assetFamilyFieldSchema>

export const assetFamilySchema = z.object({
  id: guidLikeSchema,
  key: z.string().min(1),
  label: z.string().min(1),
  fields: z.array(assetFamilyFieldSchema).default([]),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type AssetFamily = z.infer<typeof assetFamilySchema>

export const assetFamilyListSchema = z.array(assetFamilySchema)

export function buildAttributesZodSchema(
  fields: readonly AssetFamilyField[],
  messages?: { required: string },
) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    const requiredMessage = messages?.required ?? "Required"

    if (field.type === "boolean") {
      const base = z.union([z.boolean(), z.enum(["true", "false", "1", "0"])])
      shape[field.key] = field.required
        ? base
        : base.optional().nullable()
      continue
    }

    if (field.type === "number") {
      const base = z.string().trim()
      shape[field.key] = field.required
        ? base.min(1, requiredMessage).refine(
            (value) => value.length === 0 || !Number.isNaN(Number(value)),
            "Invalid number",
          )
        : base
            .optional()
            .refine(
              (value) =>
                value == null
                || value.trim().length === 0
                || !Number.isNaN(Number(value)),
              "Invalid number",
            )
      continue
    }

    const base = z.string()
    shape[field.key] = field.required
      ? base.trim().min(1, requiredMessage)
      : base.optional().nullable()
  }

  return z.object(shape)
}

export function emptyAttributesFromFields(
  fields: readonly AssetFamilyField[],
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of fields) {
    values[field.key] = field.type === "boolean" ? "false" : ""
  }
  return values
}

export function attributesToPayload(
  fields: readonly AssetFamilyField[],
  values: Record<string, unknown> | undefined | null,
): Record<string, string | null> {
  const source = values ?? {}
  const payload: Record<string, string | null> = {}

  for (const field of fields) {
    const raw = source[field.key]
    if (raw == null || raw === "") {
      payload[field.key] = null
      continue
    }

    if (typeof raw === "boolean") {
      payload[field.key] = raw ? "true" : "false"
      continue
    }

    payload[field.key] = String(raw)
  }

  return payload
}
