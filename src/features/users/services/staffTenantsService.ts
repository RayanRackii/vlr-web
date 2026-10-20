import { z } from "zod"

import {
  api,
  getAxiosErrorPayload,
  isAxiosError,
  parseApiError,
} from "@/lib/api"
import {
  selectStaffTenantResponseSchema,
  staffTenantMembershipListSchema,
  type SelectStaffTenantResponse,
  type StaffTenantMembershipList,
} from "@/features/users/schemas/staffTenantSchemas"

export const PLATFORM_ADMIN_USES_ENTER = "PLATFORM_ADMIN_USES_ENTER"

const selectStaffTenantRequestSchema = z.object({
  tenantId: z.string().uuid(),
})

export class StaffTenantError extends Error {
  readonly code: string
  readonly status: number | null

  constructor(code: string, status: number | null) {
    super(code)
    this.name = "StaffTenantError"
    this.code = code
    this.status = status
  }
}

function asStaffTenantError(error: unknown): StaffTenantError {
  if (error instanceof StaffTenantError) {
    return error
  }

  const status = isAxiosError(error) ? (error.response?.status ?? null) : null
  const code = parseApiError(getAxiosErrorPayload(error), "INVALID_RESPONSE")
  return new StaffTenantError(code, status)
}

export async function listMyStaffTenants(): Promise<StaffTenantMembershipList> {
  try {
    const response = await api.get<unknown>("/api/users/me/tenants")
    const parsed = staffTenantMembershipListSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new StaffTenantError("INVALID_RESPONSE", null)
    }

    return parsed.data
  } catch (error: unknown) {
    throw asStaffTenantError(error)
  }
}

export async function selectMyStaffTenant(
  tenantId: string,
): Promise<SelectStaffTenantResponse> {
  try {
    const body = selectStaffTenantRequestSchema.parse({ tenantId })
    const response = await api.post<unknown>("/api/users/me/tenant", body)
    const parsed = selectStaffTenantResponseSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new StaffTenantError("INVALID_RESPONSE", null)
    }

    return parsed.data
  } catch (error: unknown) {
    throw asStaffTenantError(error)
  }
}
