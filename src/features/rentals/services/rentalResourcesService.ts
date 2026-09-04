import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import { ZodError } from "zod"
import {
  assetFamilyListSchema,
  type AssetFamily,
} from "@/features/assets/schemas/assetFamilySchemas"
import {
  createRentableRequestSchema,
  registryCategoryListSchema,
  type CreateRentableRequest,
  type RegistryCategoryListItem,
} from "@/features/rentals/schemas/rentalResourceSchemas"
import {
  rentalAssetSchema,
  type AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"

function throwResourcesError(error: unknown, fallback: string): never {
  if (error instanceof ZodError) {
    throw new Error(fallback)
  }

  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  throw new Error(parseApiError(getAxiosErrorPayload(error), fallback))
}

export async function listRentalAssetCategories(): Promise<
  RegistryCategoryListItem[]
> {
  try {
    const response = await api.get<unknown>("/api/rental-assets/categories")
    return registryCategoryListSchema.parse(response.data)
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("rentals.resources.loadError"))
  }
}

export async function listRentalAssetFamilies(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/rental-assets/families")
    return assetFamilyListSchema.parse(response.data)
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("apiErrors.loadAssetFamilies"))
  }
}

export async function createRentalAsset(
  body: CreateRentableRequest,
): Promise<AdminRentalAsset> {
  const payload = createRentableRequestSchema.parse(body)

  try {
    const response = await api.post<unknown>("/api/rental-assets", payload)
    return rentalAssetSchema.parse(response.data)
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("rentals.resources.createError"))
  }
}

export async function updateRentalAsset(
  rentalAssetId: string,
  body: CreateRentableRequest,
): Promise<AdminRentalAsset> {
  const payload = createRentableRequestSchema.parse(body)

  try {
    const response = await api.put<unknown>(
      `/api/rental-assets/${rentalAssetId}`,
      payload,
    )
    return rentalAssetSchema.parse(response.data)
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("rentals.resources.updateError"))
  }
}
