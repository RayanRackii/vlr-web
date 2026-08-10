import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const tenantUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  isActive: z.boolean(),
  roles: z.array(z.string()),
  createdAt: z.string(),
})

const tenantInviteSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  roleName: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  isPending: z.boolean(),
  acceptedAt: z.string().nullable().optional(),
  revokedAt: z.string().nullable().optional(),
})

const tenantUsersBundleSchema = z.object({
  users: z.array(tenantUserSchema),
  invites: z.array(tenantInviteSchema),
})

export type TenantUser = z.infer<typeof tenantUserSchema>
export type TenantInvite = z.infer<typeof tenantInviteSchema>
export type TenantUsersBundle = z.infer<typeof tenantUsersBundleSchema>

export async function listTenantUsers(
  tenantId: string,
): Promise<TenantUsersBundle> {
  try {
    const response = await api.get<unknown>(
      `/api/admin/tenants/${tenantId}/users`,
    )
    return tenantUsersBundleSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.loadTenantUsers"),
      ),
    )
  }
}

export async function inviteTenantUser(
  tenantId: string,
  input: { fullName: string; email: string; roleName?: string },
): Promise<TenantInvite> {
  try {
    const response = await api.post<unknown>(
      `/api/admin/tenants/${tenantId}/invites`,
      {
        fullName: input.fullName,
        email: input.email,
        roleName: input.roleName ?? "Admin",
      },
    )
    return tenantInviteSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.sendInvite"),
      ),
    )
  }
}

export async function resendTenantInvite(
  tenantId: string,
  inviteId: string,
): Promise<void> {
  try {
    await api.post(`/api/admin/tenants/${tenantId}/invites/${inviteId}/resend`)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.resendInvite"),
      ),
    )
  }
}

export async function revokeTenantInvite(
  tenantId: string,
  inviteId: string,
): Promise<void> {
  try {
    await api.post(`/api/admin/tenants/${tenantId}/invites/${inviteId}/revoke`)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.revokeInvite"),
      ),
    )
  }
}

export async function promoteTenantUser(
  tenantId: string,
  userId: string,
  roleName = "Admin",
): Promise<void> {
  try {
    await api.post(`/api/admin/tenants/${tenantId}/users/${userId}/roles`, {
      roleName,
    })
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.promoteUser"),
      ),
    )
  }
}
