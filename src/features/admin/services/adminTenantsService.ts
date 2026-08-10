import {
  createTenantAdminRequestSchema,
  tenantAdminListSchema,
  tenantAdminSchema,
  updateTenantAdminRequestSchema,
  type CreateTenantAdminRequest,
  type TenantAdmin,
  type UpdateTenantAdminRequest,
} from "@/features/admin/schemas/adminTenantSchemas"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"
import { z } from "zod"

export async function listAdminTenants(): Promise<TenantAdmin[]> {
  const response = await api.get<unknown>("/api/admin/tenants")
  return tenantAdminListSchema.parse(response.data)
}

export async function getAdminTenant(tenantId: string): Promise<TenantAdmin> {
  try {
    const response = await api.get<unknown>(`/api/admin/tenants/${tenantId}`)
    return tenantAdminSchema.parse(response.data)
  } catch (error: unknown) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      i18n.t("apiErrors.loadTenant"),
    )
    throw new Error(message)
  }
}

export const getTenant = getAdminTenant

export async function deleteAdminTenant(tenantId: string): Promise<void> {
  try {
    await api.delete(`/api/admin/tenants/${tenantId}`)
  } catch (error: unknown) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      i18n.t("apiErrors.deleteTenant"),
    )
    throw new Error(message)
  }
}

export const deleteTenant = deleteAdminTenant

const enterTenantEnvironmentSchema = z.object({
  tenantId: z.string().uuid(),
  legalName: z.string(),
})

export type EnterTenantEnvironmentResult = z.infer<
  typeof enterTenantEnvironmentSchema
>

export async function enterTenantEnvironment(
  tenantId: string,
): Promise<EnterTenantEnvironmentResult> {
  try {
    const response = await api.post<unknown>(
      `/api/admin/tenants/${tenantId}/enter`,
    )
    return enterTenantEnvironmentSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.enterTenant"),
      ),
    )
  }
}

export async function exitTenantEnvironment(): Promise<void> {
  try {
    await api.post("/api/admin/tenants/exit")
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.exitTenant"),
      ),
    )
  }
}

export async function createAdminTenant(
  payload: CreateTenantAdminRequest,
): Promise<TenantAdmin> {
  const body = createTenantAdminRequestSchema.parse(payload)

  try {
    const response = await api.post<unknown>("/api/admin/tenants", {
      legalName: body.legalName,
      taxId: body.taxId,
      subdomain: body.subdomain,
      logoSvg: body.logoSvg || null,
      primaryColor: body.primaryColor || null,
      accentColor: body.accentColor || null,
      welcomeTagline: body.welcomeTagline || null,
      activeModules: body.activeModules,
      assetFamilyKeys: body.assetFamilyKeys,
      adminFullName: body.adminFullName || null,
      adminEmail: body.adminEmail || null,
    })

    return tenantAdminSchema.parse(response.data)
  } catch (error: unknown) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      i18n.t("apiErrors.createTenant"),
    )
    throw new Error(message)
  }
}

export async function updateAdminTenant(
  tenantId: string,
  payload: UpdateTenantAdminRequest,
): Promise<TenantAdmin> {
  const body = updateTenantAdminRequestSchema.parse(payload)

  try {
    const response = await api.put<unknown>(`/api/admin/tenants/${tenantId}`, {
      legalName: body.legalName,
      taxId: body.taxId,
      subdomain: body.subdomain,
      logoSvg: body.logoSvg || null,
      primaryColor: body.primaryColor || null,
      accentColor: body.accentColor || null,
      welcomeTagline: body.welcomeTagline || null,
      activeModules: body.activeModules,
      assetFamilyKeys: body.assetFamilyKeys,
    })

    return tenantAdminSchema.parse(response.data)
  } catch (error: unknown) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      i18n.t("apiErrors.updateTenant"),
    )
    throw new Error(message)
  }
}

export const updateTenant = updateAdminTenant
