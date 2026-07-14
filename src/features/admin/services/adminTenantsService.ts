import {
  createTenantAdminRequestSchema,
  tenantAdminListSchema,
  tenantAdminSchema,
  type CreateTenantAdminRequest,
  type TenantAdmin,
} from "@/features/admin/schemas/adminTenantSchemas"
import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"

export async function listAdminTenants(): Promise<TenantAdmin[]> {
  const response = await api.get<unknown>("/api/admin/tenants")
  return tenantAdminListSchema.parse(response.data)
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
      logoUrl: body.logoUrl || null,
      activeModules: body.activeModules,
    })

    return tenantAdminSchema.parse(response.data)
  } catch (error: unknown) {
    const message = parseApiError(
      getAxiosErrorPayload(error),
      "Failed to create tenant.",
    )
    throw new Error(message)
  }
}
