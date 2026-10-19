import i18n from "@/lib/i18n"
import { api, isAxiosError } from "@/lib/api"
import { describeApiError } from "@/features/users/permissions/rbacErrors"
import { ZodError } from "zod"
import {
  assetFamilyListSchema,
  type AssetFamily,
} from "@/features/assets/schemas/assetFamilySchemas"

function throwFamiliesError(error: unknown, fallback: string): never {
  if (error instanceof ZodError) {
    throw new Error(fallback)
  }

  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  throw new Error(describeApiError(error, fallback))
}

export async function listAdminAssetFamilyCatalog(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/admin/asset-families")
    return assetFamilyListSchema.parse(response.data)
  } catch (error: unknown) {
    throwFamiliesError(error, i18n.t("apiErrors.loadAssetFamilies"))
  }
}

export async function listAssetFamilyCatalog(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/asset-families")
    return assetFamilyListSchema.parse(response.data)
  } catch (error: unknown) {
    throwFamiliesError(error, i18n.t("apiErrors.loadAssetFamilies"))
  }
}

export async function listActiveAssetFamilies(): Promise<AssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/asset-families/active")
    return assetFamilyListSchema.parse(response.data)
  } catch (error: unknown) {
    throwFamiliesError(error, i18n.t("apiErrors.loadAssetFamilies"))
  }
}
