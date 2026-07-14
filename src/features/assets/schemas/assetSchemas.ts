import { z } from "zod"

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
})

export type UpdateAssetRequest = z.infer<typeof updateAssetRequestSchema>

export const deleteAssetResultSchema = z.object({
  permanentlyDeleted: z.boolean(),
  asset: assetSchema.nullish(),
})

export type DeleteAssetResult = z.infer<typeof deleteAssetResultSchema>

export const bulkCreateAssetsRequestSchema = z.object({
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  baseLocationName: z.string().trim().min(1),
  baseTag: z.string().trim().min(1),
  startNumber: z.number().int(),
  endNumber: z.number().int(),
  isRentable: z.boolean().optional(),
  requiresMaintenance: z.boolean().optional(),
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

export function createBulkCreateAssetsFormSchema(messages: {
  unitRequired: string
  categoryRequired: string
  baseLocationRequired: string
  baseTagRequired: string
  startNumberRequired: string
  endNumberRequired: string
  rangeInvalid: string
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
      baseLocationName: z.string().trim().min(1, messages.baseLocationRequired),
      baseTag: z.string().trim().min(1, messages.baseTagRequired),
      startNumber: z
        .number({ error: messages.startNumberRequired })
        .int(messages.startNumberRequired),
      endNumber: z
        .number({ error: messages.endNumberRequired })
        .int(messages.endNumberRequired),
    })
    .refine((values) => values.startNumber <= values.endNumber, {
      message: messages.rangeInvalid,
      path: ["endNumber"],
    })
}

export type BulkCreateAssetsFormValues = z.infer<
  ReturnType<typeof createBulkCreateAssetsFormSchema>
>
