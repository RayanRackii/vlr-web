import { z } from "zod"

export const assetCategorySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  manufacturer: z.string().nullish(),
  description: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
  scheduledDeletionAt: z.string().nullish(),
  linkedAssetsCount: z.number().int().nonnegative().optional().default(0),
})

export type AssetCategory = z.infer<typeof assetCategorySchema>

export const assetCategoryListSchema = z.array(assetCategorySchema)

export const deleteAssetCategoryResultSchema = z.object({
  permanentlyDeleted: z.boolean(),
  affectedAssetsCount: z.number().int().nonnegative(),
  category: assetCategorySchema.nullish(),
})

export type DeleteAssetCategoryResult = z.infer<
  typeof deleteAssetCategoryResultSchema
>

export const createAssetCategoryRequestSchema = z.object({
  name: z.string().trim().min(1),
  manufacturer: z.string().trim().min(1),
  description: z.string().trim().optional(),
})

export type CreateAssetCategoryRequest = z.infer<
  typeof createAssetCategoryRequestSchema
>

export function createAssetCategoryFormSchema(messages: {
  nameRequired: string
  manufacturerRequired: string
}) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired),
    manufacturer: z.string().trim().min(1, messages.manufacturerRequired),
    description: z.string().trim().optional(),
  })
}

export type CreateAssetCategoryFormValues = z.infer<
  ReturnType<typeof createAssetCategoryFormSchema>
>
