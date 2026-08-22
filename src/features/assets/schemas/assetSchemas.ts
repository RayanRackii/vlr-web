import { z } from "zod"

import { guidLikeIdSchema } from "@/features/assets/schemas/assetFamilySchemas"

export const assetStatusSchema = z.enum(["Active", "Inactive", "Maintenance"])

export type AssetStatus = z.infer<typeof assetStatusSchema>

const assetStatusByIndex = [
  "Active",
  "Inactive",
  "Maintenance",
] as const satisfies readonly AssetStatus[]

/** ASP.NET may serialize enums as numbers unless JsonStringEnumConverter is enabled. */
export const assetStatusResponseSchema = z.union([
  assetStatusSchema,
  z
    .number()
    .int()
    .refine(
      (value): value is 0 | 1 | 2 => value >= 0 && value < assetStatusByIndex.length,
    )
    .transform((value) => assetStatusByIndex[value]),
])

export const assetSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  familyId: guidLikeIdSchema,
  attributes: z
    .record(z.string(), z.string().nullable())
    .default({}),
  name: z.string().min(1),
  tag: z.string().min(1),
  location: z.string().nullish(),
  serialNumber: z.string().nullish(),
  installationDate: z.string().nullish(),
  status: assetStatusResponseSchema,
  isRentable: z.boolean(),
  requiresMaintenance: z.boolean(),
  rentalConfig: z
    .object({
      rentalAssetId: z.string().uuid(),
      type: z.enum(["Location", "Good"]),
      totalQuantity: z.number().int(),
      isActive: z.boolean(),
      requiresDeposit: z.boolean().optional().default(true),
      queueEnabled: z.boolean().optional().default(false),
      queueOpeningTime: z.string().nullish().transform((value) => value || null),
    })
    .nullish(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
  scheduledDeletionAt: z.string().nullish(),
})

export type Asset = z.infer<typeof assetSchema>

export const assetListSchema = z.array(assetSchema)

export const updateAssetRequestSchema = z.object({
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  familyId: guidLikeIdSchema,
  attributes: z.record(z.string(), z.string().nullable()).default({}),
  name: z.string().trim().min(1),
  tag: z.string().trim().min(1),
  location: z.string().nullish(),
  serialNumber: z.string().nullish(),
  installationDate: z.string().nullish(),
  status: assetStatusSchema,
  isRentable: z.boolean(),
  requiresMaintenance: z.boolean(),
  rentalType: z.enum(["Location", "Good"]).default("Location"),
  totalQuantity: z.number().int().min(1).default(1),
  requiresDeposit: z.boolean().default(true),
  queueEnabled: z.boolean().optional().default(false),
  queueOpeningTime: z.string().nullable().optional().default(null),
})

export type UpdateAssetRequest = z.infer<typeof updateAssetRequestSchema>

export const createAssetRequestSchema = z.object({
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  familyId: guidLikeIdSchema,
  attributes: z.record(z.string(), z.string().nullable()).default({}),
  name: z.string().trim().min(1),
  tag: z.string().trim().min(1),
  location: z.string().nullish(),
  serialNumber: z.string().nullish(),
  installationDate: z.string().nullish(),
  status: assetStatusSchema.default("Active"),
  isRentable: z.boolean().default(false),
  requiresMaintenance: z.boolean().default(false),
  rentalType: z.enum(["Location", "Good"]).default("Location"),
  totalQuantity: z.number().int().min(1).default(1),
  requiresDeposit: z.boolean().default(true),
  queueEnabled: z.boolean().optional().default(false),
  queueOpeningTime: z.string().nullable().optional().default(null),
})

export type CreateAssetRequest = z.infer<typeof createAssetRequestSchema>

export const deleteAssetResultSchema = z.object({
  permanentlyDeleted: z.boolean(),
  asset: assetSchema.nullish(),
})

export type DeleteAssetResult = z.infer<typeof deleteAssetResultSchema>

export const bulkCreateAssetsRequestSchema = z.object({
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  familyId: guidLikeIdSchema,
  attributes: z.record(z.string(), z.string().nullable()).default({}),
  baseLocationName: z.string().trim().min(1),
  baseTag: z.string().trim().min(1),
  startNumber: z.number().int().nullish(),
  endNumber: z.number().int().nullish(),
  rentalType: z.enum(["Location", "Good"]).default("Location"),
  totalQuantity: z.number().int().min(1).default(1),
  isRentable: z.boolean().optional(),
  requiresMaintenance: z.boolean().optional(),
  requiresDeposit: z.boolean().optional().default(true),
  queueEnabled: z.boolean().optional().default(false),
  queueOpeningTime: z.string().nullable().optional().default(null),
})

export type BulkCreateAssetsRequest = z.infer<
  typeof bulkCreateAssetsRequestSchema
>

export const bulkCreateAssetsResponseSchema = z.object({
  createdCount: z.number().int().nonnegative(),
  assets: assetListSchema,
})

export type BulkCreateAssetsResponse = z.infer<
  typeof bulkCreateAssetsResponseSchema
>

export const dayOfWeekSchema = z.enum([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
])

export const bulkPricingRowSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  pricePerHour: z.number().nonnegative(),
  requiresDeposit: z.boolean(),
  depositPercentage: z.number().min(0).max(100),
})

export type BulkPricingRow = z.infer<typeof bulkPricingRowSchema>

export const bulkApplyPricingsRequestSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(1000),
  pricings: z.array(bulkPricingRowSchema).max(100),
  replace: z.boolean(),
})

export type BulkApplyPricingsRequest = z.infer<
  typeof bulkApplyPricingsRequestSchema
>

export const bulkApplyPricingsResponseSchema = z.object({
  appliedAssetCount: z.number().int().nonnegative(),
  pricingsCreated: z.number().int().nonnegative(),
})

export type BulkApplyPricingsResponse = z.infer<
  typeof bulkApplyPricingsResponseSchema
>

export function createBulkCreateAssetsFormSchema(messages: {
  unitRequired: string
  categoryRequired: string
  familyRequired: string
  baseLocationRequired: string
  baseTagRequired: string
  startNumberRequired: string
  endNumberRequired: string
  rangeInvalid: string
  stockQuantityRequired: string
}) {
  return z
    .object({
      unitId: z
        .string()
        .min(1, messages.unitRequired)
        .uuid(messages.unitRequired),
      categoryId: z
        .string()
        .min(1, messages.categoryRequired)
        .uuid(messages.categoryRequired),
      familyId: z
        .string()
        .min(1, messages.familyRequired)
        .regex(
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
          messages.familyRequired,
        ),
      attributes: z.record(z.string(), z.string()),
      baseLocationName: z.string().trim().min(1, messages.baseLocationRequired),
      baseTag: z.string().trim().min(1, messages.baseTagRequired),
      rentalType: z.enum(["Location", "Good"]).default("Location"),
      totalQuantity: z
        .number({ error: messages.stockQuantityRequired })
        .int(messages.stockQuantityRequired)
        .min(1, messages.stockQuantityRequired)
        .default(1),
      startNumber: z
        .number({ error: messages.startNumberRequired })
        .int(messages.startNumberRequired)
        .optional(),
      endNumber: z
        .number({ error: messages.endNumberRequired })
        .int(messages.endNumberRequired)
        .optional(),
    })
    .refine(
      (values) =>
        values.startNumber == null ||
        values.endNumber == null ||
        values.startNumber <= values.endNumber,
      {
        message: messages.rangeInvalid,
        path: ["endNumber"],
      },
    )
}

export type BulkCreateAssetsFormValues = z.infer<
  ReturnType<typeof createBulkCreateAssetsFormSchema>
>

/** HTML `type="time"` value (`HH:mm`) from API TimeOnly (`HH:mm:ss`). */
export function toHtmlTimeInput(value: string | null | undefined): string {
  if (!value) {
    return ""
  }
  const match = /^(\d{2}:\d{2})/.exec(value)
  return match?.[1] ?? ""
}

/** Persist TimeOnly as `HH:mm:ss`, or null when empty. */
export function toApiTimeOnly(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) {
    return null
  }
  if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 8)
  }
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }
  return trimmed
}
