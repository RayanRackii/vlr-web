import { z } from "zod"

import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const dayOfWeekSchema = z.enum([
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
])

const dayOfWeekByIndex = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const dayOfWeekResponseSchema = z.union([
  dayOfWeekSchema,
  z
    .number()
    .int()
    .refine((value): value is 0 | 1 | 2 | 3 | 4 | 5 | 6 => value >= 0 && value <= 6)
    .transform((value) => dayOfWeekByIndex[value]),
])

export const rentalPricingSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  assetId: z.string().uuid(),
  rentalAssetId: z.string().uuid(),
  dayOfWeek: dayOfWeekResponseSchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  pricePerHour: z.number(),
  requiresDeposit: z.boolean(),
  depositPercentage: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
})

export type RentalPricing = z.infer<typeof rentalPricingSchema>

export const rentalPricingListSchema = z.array(rentalPricingSchema)

export const createRentalPricingSchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  pricePerHour: z.number().nonnegative(),
  requiresDeposit: z.boolean(),
  depositPercentage: z.number().min(0).max(100),
})

export type CreateRentalPricingRequest = z.infer<typeof createRentalPricingSchema>

export async function getAssetPricings(assetId: string): Promise<RentalPricing[]> {
  try {
    const response = await api.get<unknown>(`/api/assets/${assetId}/pricing`)
    const parsed = rentalPricingListSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("assets.detail.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.detail.errors.pricingLoadFailed"),
      ),
    )
  }
}

export async function createAssetPricing(
  assetId: string,
  data: CreateRentalPricingRequest,
): Promise<RentalPricing> {
  const payload = createRentalPricingSchema.parse(data)

  try {
    const response = await api.post<unknown>(
      `/api/assets/${assetId}/pricing`,
      payload,
    )
    const parsed = rentalPricingSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("assets.detail.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.detail.errors.pricingCreateFailed"),
      ),
    )
  }
}

export async function deleteAssetPricing(
  assetId: string,
  pricingId: string,
): Promise<void> {
  try {
    await api.delete(`/api/assets/${assetId}/pricing/${pricingId}`)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.detail.errors.pricingDeleteFailed"),
      ),
    )
  }
}
