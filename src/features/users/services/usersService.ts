import i18n from "@/lib/i18n"
import { api } from "@/lib/api"
import { throwRbacServiceError } from "@/features/users/permissions/rbacErrors"
import {
  assignUserRolesRequestSchema,
  currentUserSchema,
  inviteTenantMemberRequestSchema,
  inviteTenantMemberResponseSchema,
  technicianUserListSchema,
  tenantMemberListSchema,
  type AssignUserRolesRequest,
  type CurrentUser,
  type InviteTenantMemberRequest,
  type InviteTenantMemberResponse,
  type TechnicianUser,
  type TenantMember,
} from "@/features/users/schemas/userSchemas"

const USERS_PATH = "/api/users"

function parseOrThrow<T>(
  success: boolean,
  data: T | undefined,
  fallbackKey: string,
): T {
  if (!success || data === undefined) {
    throw new Error(i18n.t(fallbackKey))
  }

  return data
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    const response = await api.get<unknown>(`${USERS_PATH}/me`)
    const parsed = currentUserSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "users.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "users.errors.loadCurrent")
  }
}

export async function getTechnicians(): Promise<TechnicianUser[]> {
  try {
    const response = await api.get<unknown>(`${USERS_PATH}/technicians`)
    const parsed = technicianUserListSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "users.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "users.errors.loadTechnicians")
  }
}

export async function listTenantMembers(): Promise<TenantMember[]> {
  try {
    const response = await api.get<unknown>(USERS_PATH)
    const parsed = tenantMemberListSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "users.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.loadUsers")
  }
}

export async function assignUserRoles(
  userId: string,
  request: AssignUserRolesRequest,
): Promise<void> {
  const body = assignUserRolesRequestSchema.parse(request)

  try {
    await api.put(`${USERS_PATH}/${userId}/roles`, body)
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.assignRoles")
  }
}

export async function inviteTenantMember(
  request: InviteTenantMemberRequest,
): Promise<InviteTenantMemberResponse> {
  const body = inviteTenantMemberRequestSchema.parse(request)

  try {
    const response = await api.post<unknown>(`${USERS_PATH}/invite`, body)
    const parsed = inviteTenantMemberResponseSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "users.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.invite")
  }
}
