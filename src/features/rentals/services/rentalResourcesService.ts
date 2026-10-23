import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import { mapRbacErrorMessage } from "@/features/users/permissions/rbacErrors"
import { ZodError } from "zod"
import {
  assetFamilyListSchema,
  type AssetFamily,
} from "@/features/assets/schemas/assetFamilySchemas"
import {
  createRentalCategoryRequestSchema,
  createRentableRequestSchema,
  registryCategoryListSchema,
  registryCategoryListItemSchema,
  type CreateRentalCategoryRequest,
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

  throw new Error(
    mapRbacErrorMessage(parseApiError(getAxiosErrorPayload(error), fallback), fallback),
    { cause: error },
  )
}

export async function listRentalAssetCategories(): Promise<
  RegistryCategoryListItem[]
> {
  try {
    const response = await api.get<unknown>("/api/rental-assets/categories")
    const parsed = registryCategoryListSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("rentals.resources.loadError"))
  }
}

export async function createRentalCategory(
  body: CreateRentalCategoryRequest,
): Promise<RegistryCategoryListItem> {
  const payload = createRentalCategoryRequestSchema.parse(body)

  try {
    const response = await api.post<unknown>("/api/rental-assets/categories", payload)
    const parsed = registryCategoryListItemSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("rentals.resources.createError"))
  }
}

export async function listRentalAssetFamilies(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/rental-assets/families")
    const parsed = assetFamilyListSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
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
    const parsed = rentalAssetSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
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
    const parsed = rentalAssetSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error: unknown) {
    throwResourcesError(error, i18n.t("rentals.resources.updateError"))
  }
}
