import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  assetListSchema,
  assetSchema,
  bulkCreateAssetsRequestSchema,
  bulkCreateAssetsResponseSchema,
  deleteAssetResultSchema,
  updateAssetRequestSchema,
  type Asset,
  type BulkCreateAssetsRequest,
  type BulkCreateAssetsResponse,
  type DeleteAssetResult,
  type UpdateAssetRequest,
} from "@/features/assets/schemas/assetSchemas"

const ASSETS_PATH = "/api/assets"

function throwAssetsError(error: unknown, fallbackKey: string): never {
  console.error(fallbackKey, error)
  if (isAxiosError(error)) {
    console.error(`${fallbackKey} response data`, error.response?.data)
  }

  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  throw new Error(
    parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
  )
}

export async function getAssets(): Promise<Asset[]> {
  try {
    const response = await api.get<unknown>(ASSETS_PATH)
    const parsed = assetListSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getAssets Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.inventory.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    throwAssetsError(error, "assets.inventory.errors.loadFailed")
  }
}

export async function getAssetById(id: string): Promise<Asset> {
  try {
    const response = await api.get<unknown>(`${ASSETS_PATH}/${id}`)
    const parsed = assetSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("assets.inventory.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    throwAssetsError(error, "assets.inventory.errors.loadFailed")
  }
}

export async function updateAsset(
  id: string,
  data: UpdateAssetRequest,
): Promise<Asset> {
  const payload = updateAssetRequestSchema.parse(data)

  try {
    const response = await api.put<unknown>(`${ASSETS_PATH}/${id}`, payload)
    const parsed = assetSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("assets.inventory.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    throwAssetsError(error, "assets.inventory.errors.updateFailed")
  }
}

export async function bulkCreateAssets(
  data: BulkCreateAssetsRequest,
): Promise<BulkCreateAssetsResponse> {
  const validatedPayload = bulkCreateAssetsRequestSchema.parse(data)

  try {
    const response = await api.post<unknown>(
      `${ASSETS_PATH}/bulk`,
      validatedPayload,
    )
    const responseData = response.data
    const parsed = bulkCreateAssetsResponseSchema.safeParse(responseData)

    if (!parsed.success) {
      console.error("bulkCreateAssets Zod validation failed", {
        data: responseData,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.inventory.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    throwAssetsError(error, "assets.inventory.errors.bulkCreateFailed")
  }
}

export async function deleteAsset(id: string): Promise<DeleteAssetResult> {
  try {
    const response = await api.delete<unknown>(`${ASSETS_PATH}/${id}`)

    if (response.status === 204) {
      return {
        permanentlyDeleted: true,
        asset: null,
      }
    }

    const parsed = deleteAssetResultSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("deleteAsset Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.inventory.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    throwAssetsError(error, "assets.inventory.errors.deleteFailed")
  }
}
