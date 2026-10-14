import i18n from "@/lib/i18n"
import { api } from "@/lib/api"
import { throwRbacServiceError } from "@/features/users/permissions/rbacErrors"
import {
  invalidateCurrentUserCache,
  readCurrentUser,
} from "@/features/users/services/currentUserCache"
import { isCanceledRequest } from "@/features/users/services/requestCancellation"
import {
  assignUserRolesRequestSchema,
  currentUserSchema,
  inviteTenantMemberRequestSchema,
  inviteTenantMemberResponseSchema,
  technicianUserListSchema,
  tenantCustomerPageSchema,
  tenantMemberPageSchema,
  type AssignUserRolesRequest,
  type CurrentUser,
  type DirectoryQuery,
  type InviteTenantMemberRequest,
  type InviteTenantMemberResponse,
  type TechnicianUser,
  type TenantCustomerPage,
  type TenantMemberPage,
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

export type GetCurrentUserOptions = {
  /** Bypass the session cache and in-flight request (profile refresh). */
  force?: boolean
}

async function loadCurrentUserFromApi(): Promise<CurrentUser> {
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

export async function getCurrentUser(
  options?: GetCurrentUserOptions,
): Promise<CurrentUser> {
  if (options?.force) {
    invalidateCurrentUserCache()
  }

  return readCurrentUser(loadCurrentUserFromApi)
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

function directoryConfig(query?: DirectoryQuery) {
  return {
    params: {
      q: query?.q,
      page: query?.page,
      pageSize: query?.pageSize,
    },
  }
}

export async function listTenantMembers(
  query?: DirectoryQuery,
): Promise<TenantMemberPage> {
  try {
    const response = await api.get<unknown>(USERS_PATH, directoryConfig(query))
    const parsed = tenantMemberPageSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "users.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.loadUsers")
  }
}

export async function listTenantCustomers(
  query?: DirectoryQuery,
  signal?: AbortSignal,
): Promise<TenantCustomerPage> {
  try {
    const response = await api.get<unknown>("/api/customers", {
      ...directoryConfig(query),
      ...(signal !== undefined ? { signal } : {}),
    })
    const parsed = tenantCustomerPageSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "users.errors.invalidResponse",
    )
  } catch (error: unknown) {
    if (isCanceledRequest(error)) {
      throw error
    }

    throwRbacServiceError(error, "peopleAccess.errors.loadCustomers")
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
