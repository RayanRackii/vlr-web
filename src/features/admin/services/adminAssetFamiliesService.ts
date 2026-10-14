import { ZodError } from "zod"

import {
  adminAssetFamilyListSchema,
  adminAssetFamilySchema,
  type AdminAssetFamily,
  type CreateAdminAssetFamilyRequest,
  type UpdateAdminAssetFamilyRequest,
} from "@/features/admin/schemas/adminAssetFamilySchemas"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

function throwAdminAssetFamilyError(error: unknown, fallback: string): never {
  if (error instanceof ZodError) {
    throw new Error(i18n.t("apiErrors.invalidResponse"))
  }

  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  const forbidden =
    isAxiosError(error) && error.response?.status === 403
      ? i18n.t("admin.errors.forbidden")
      : fallback

  throw new Error(parseApiError(getAxiosErrorPayload(error), forbidden))
}

export async function listAdminAssetFamilies(options: {
  includeInactive?: boolean
} = {}): Promise<AdminAssetFamily[]> {
  try {
    const response = await api.get<unknown>("/api/admin/asset-families", {
      params: options.includeInactive ? { includeInactive: true } : undefined,
    })
    const parsed = adminAssetFamilyListSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new ZodError(parsed.error.issues)
    }

    return parsed.data
  } catch (error: unknown) {
    throwAdminAssetFamilyError(error, i18n.t("apiErrors.loadAdminAssetFamilies"))
  }
}

export async function getAdminAssetFamily(id: string): Promise<AdminAssetFamily> {
  try {
    const response = await api.get<unknown>(
      `/api/admin/asset-families/${encodeURIComponent(id)}`,
    )
    const parsed = adminAssetFamilySchema.safeParse(response.data)

    if (!parsed.success) {
      throw new ZodError(parsed.error.issues)
    }

    return parsed.data
  } catch (error: unknown) {
    throwAdminAssetFamilyError(error, i18n.t("apiErrors.loadAdminAssetFamilies"))
  }
}

export async function createAdminAssetFamily(
  request: CreateAdminAssetFamilyRequest,
): Promise<AdminAssetFamily> {
  try {
    const response = await api.post<unknown>("/api/admin/asset-families", request)
    const parsed = adminAssetFamilySchema.safeParse(response.data)

    if (!parsed.success) {
      throw new ZodError(parsed.error.issues)
    }

    return parsed.data
  } catch (error: unknown) {
    throwAdminAssetFamilyError(error, i18n.t("apiErrors.createAdminAssetFamily"))
  }
}

export async function updateAdminAssetFamily(
  id: string,
  request: UpdateAdminAssetFamilyRequest,
): Promise<AdminAssetFamily> {
  try {
    const response = await api.put<unknown>(
      `/api/admin/asset-families/${encodeURIComponent(id)}`,
      request,
    )
    const parsed = adminAssetFamilySchema.safeParse(response.data)

    if (!parsed.success) {
      throw new ZodError(parsed.error.issues)
    }

    return parsed.data
  } catch (error: unknown) {
    throwAdminAssetFamilyError(error, i18n.t("apiErrors.updateAdminAssetFamily"))
  }
}

export async function deleteAdminAssetFamily(id: string): Promise<void> {
  try {
    await api.delete(`/api/admin/asset-families/${encodeURIComponent(id)}`)
  } catch (error: unknown) {
    throwAdminAssetFamilyError(error, i18n.t("apiErrors.deleteAdminAssetFamily"))
  }
}
