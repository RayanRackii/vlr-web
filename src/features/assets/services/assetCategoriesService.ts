import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  assetCategoryListSchema,
  assetCategorySchema,
  createAssetCategoryRequestSchema,
  deleteAssetCategoryResultSchema,
  type AssetCategory,
  type CreateAssetCategoryRequest,
  type DeleteAssetCategoryResult,
} from "@/features/assets/schemas/assetCategorySchemas"

const ASSET_CATEGORIES_PATH = "/api/asset-categories"

export async function getCategories(): Promise<AssetCategory[]> {
  try {
    const response = await api.get<unknown>(ASSET_CATEGORIES_PATH)
    const data = response.data
    const parsed = assetCategoryListSchema.safeParse(data)

    if (!parsed.success) {
      console.error("getCategories Zod validation failed", {
        data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.categories.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getCategories failed", error)
    if (isAxiosError(error)) {
      console.error("getCategories response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.categories.errors.loadFailed"),
      ),
    )
  }
}

export async function createCategory(
  payload: CreateAssetCategoryRequest,
): Promise<AssetCategory> {
  const validatedPayload = createAssetCategoryRequestSchema.parse(payload)

  try {
    const response = await api.post<unknown>(ASSET_CATEGORIES_PATH, {
      name: validatedPayload.name,
      manufacturer: validatedPayload.manufacturer,
      description: validatedPayload.description || null,
    })
    const data = response.data
    const parsed = assetCategorySchema.safeParse(data)

    if (!parsed.success) {
      console.error("createCategory Zod validation failed", {
        data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.categories.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("createCategory failed", error)
    if (isAxiosError(error)) {
      console.error("createCategory response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.categories.errors.createFailed"),
      ),
    )
  }
}

export async function updateCategory(
  id: string,
  payload: CreateAssetCategoryRequest,
): Promise<AssetCategory> {
  const validatedPayload = createAssetCategoryRequestSchema.parse(payload)

  try {
    const response = await api.put<unknown>(`${ASSET_CATEGORIES_PATH}/${id}`, {
      name: validatedPayload.name,
      manufacturer: validatedPayload.manufacturer,
      description: validatedPayload.description || null,
    })
    const data = response.data
    const parsed = assetCategorySchema.safeParse(data)

    if (!parsed.success) {
      console.error("updateCategory Zod validation failed", {
        data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.categories.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("updateCategory failed", error)
    if (isAxiosError(error)) {
      console.error("updateCategory response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.categories.errors.updateFailed"),
      ),
    )
  }
}

export async function deleteCategory(
  id: string,
): Promise<DeleteAssetCategoryResult> {
  try {
    const response = await api.delete<unknown>(`${ASSET_CATEGORIES_PATH}/${id}`)

    if (response.status === 204) {
      return {
        permanentlyDeleted: true,
        affectedAssetsCount: 0,
        category: null,
      }
    }

    const parsed = deleteAssetCategoryResultSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("deleteCategory Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.categories.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("deleteCategory failed", error)
    if (isAxiosError(error)) {
      console.error("deleteCategory response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.categories.errors.deleteFailed"),
      ),
    )
  }
}
