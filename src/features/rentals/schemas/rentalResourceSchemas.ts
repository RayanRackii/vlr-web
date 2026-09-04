import { z } from "zod"

import { guidLikeIdSchema } from "@/features/assets/schemas/assetFamilySchemas"
import { toApiTimeOnly } from "@/features/assets/schemas/assetSchemas"

export const rentalTypeValues = ["Location", "Good"] as const

export type RentalType = (typeof rentalTypeValues)[number]

export const registryCategoryListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
})

export type RegistryCategoryListItem = z.infer<
  typeof registryCategoryListItemSchema
>

export const registryCategoryListSchema = z.array(registryCategoryListItemSchema)

export const createRentableRequestSchema = z.object({
  name: z.string().trim().min(1),
  tag: z.string().trim().min(1),
  unitId: z.string().uuid(),
  categoryId: z.string().uuid(),
  familyId: guidLikeIdSchema,
  rentalType: z.enum(rentalTypeValues),
  totalQuantity: z.number().int().min(1),
  requiresDeposit: z.boolean(),
  queueEnabled: z.boolean(),
  queueOpeningTime: z.string().nullable(),
  location: z.string().nullable(),
})

export type CreateRentableRequest = z.infer<typeof createRentableRequestSchema>

export function createRentalResourceFormSchema(messages: {
  nameRequired: string
  tagRequired: string
  unitRequired: string
  categoryRequired: string
  familyRequired: string
  quantityMin: string
  queueOpeningTimeRequired: string
}) {
  return z
    .object({
      name: z.string().trim().min(1, messages.nameRequired),
      tag: z.string().trim().min(1, messages.tagRequired),
      unitId: z.string().min(1, messages.unitRequired).uuid(messages.unitRequired),
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
      rentalType: z.enum(rentalTypeValues),
      totalQuantity: z.number().int().min(1, messages.quantityMin),
      requiresDeposit: z.boolean(),
      queueEnabled: z.boolean(),
      queueOpeningTime: z.string(),
      location: z.string(),
    })
    .superRefine((values, ctx) => {
      if (
        values.rentalType === "Location" &&
        values.queueEnabled &&
        values.queueOpeningTime.trim().length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["queueOpeningTime"],
          message: messages.queueOpeningTimeRequired,
        })
      }
    })
}

export type RentalResourceFormValues = z.infer<
  ReturnType<typeof createRentalResourceFormSchema>
>

export function toCreateRentableRequest(
  values: RentalResourceFormValues,
): CreateRentableRequest {
  const isLocation = values.rentalType === "Location"

  return createRentableRequestSchema.parse({
    name: values.name.trim(),
    tag: values.tag.trim(),
    unitId: values.unitId,
    categoryId: values.categoryId,
    familyId: values.familyId,
    rentalType: values.rentalType,
    totalQuantity: isLocation ? 1 : values.totalQuantity,
    requiresDeposit: values.requiresDeposit,
    queueEnabled: isLocation ? values.queueEnabled : false,
    queueOpeningTime:
      isLocation && values.queueEnabled
        ? toApiTimeOnly(values.queueOpeningTime)
        : null,
    location: values.location.trim() ? values.location.trim() : null,
  })
}
