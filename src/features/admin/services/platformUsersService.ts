import { z } from "zod"

import { api, getAxiosErrorPayload, parseApiError } from "@/lib/api"
import i18n from "@/lib/i18n"

const platformUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  isActive: z.boolean(),
  tenantId: z.string().uuid(),
  tenantLegalName: z.string(),
  tenantSubdomain: z.string().nullable().optional(),
  roles: z.array(z.string()),
  createdAt: z.string(),
})

const platformUserListSchema = z.array(platformUserSchema)

export type PlatformUser = z.infer<typeof platformUserSchema>

export type ListPlatformUsersParams = {
  name?: string
  tenantId?: string
}

export async function listPlatformUsers(
  params: ListPlatformUsersParams = {},
): Promise<PlatformUser[]> {
  try {
    const response = await api.get<unknown>("/api/admin/users", {
      params: {
        name: params.name?.trim() || undefined,
        tenantId: params.tenantId || undefined,
      },
    })
    return platformUserListSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.loadUsers"),
      ),
    )
  }
}

export async function deletePlatformUser(userId: string): Promise<void> {
  try {
    await api.delete(`/api/admin/users/${userId}`)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("apiErrors.deleteUser"),
      ),
    )
  }
}
