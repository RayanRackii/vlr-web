import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  assetFamilyListSchema,
  type AssetFamily,
} from "@/features/assets/schemas/assetFamilySchemas"

function throwFamiliesError(error: unknown, fallback: string): never {
  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  throw new Error(parseApiError(getAxiosErrorPayload(error), fallback))
}

export async function listAssetFamilyCatalog(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/asset-families")
    return assetFamilyListSchema.parse(response.data)
  } catch (error: unknown) {
    throwFamiliesError(
      error,
      i18n.t("admin.wizard.errors.familiesLoadFailed", {
        defaultValue: "Failed to load asset families.",
      }),
    )
  }
}

export async function listActiveAssetFamilies(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/asset-families/active")
    return assetFamilyListSchema.parse(response.data)
  } catch (error: unknown) {
    throwFamiliesError(
      error,
      i18n.t("assets.inventory.errors.familiesLoadFailed", {
        defaultValue: "Failed to load asset families.",
      }),
    )
  }
}
