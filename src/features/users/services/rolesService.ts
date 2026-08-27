import i18n from "@/lib/i18n"
import { api } from "@/lib/api"
import { throwRbacServiceError } from "@/features/users/permissions/rbacErrors"
import {
  permissionCatalogListSchema,
  roleResponseListSchema,
  roleResponseSchema,
  type CreateRoleRequest,
  type PermissionCatalogItemDto,
  type RoleResponse,
} from "@/features/users/schemas/roleSchemas"

const ROLES_PATH = "/api/roles"
const PERMISSIONS_PATH = "/api/permissions"

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

export async function listRoles(): Promise<RoleResponse[]> {
  try {
    const response = await api.get<unknown>(ROLES_PATH)
    const parsed = roleResponseListSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "peopleAccess.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.loadRoles")
  }
}

export async function getRole(roleId: string): Promise<RoleResponse> {
  try {
    const response = await api.get<unknown>(`${ROLES_PATH}/${roleId}`)
    const parsed = roleResponseSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "peopleAccess.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.loadRole")
  }
}

export async function createRole(
  request: CreateRoleRequest,
): Promise<RoleResponse> {
  try {
    const response = await api.post<unknown>(ROLES_PATH, {
      name: request.name,
      description: request.description?.trim()
        ? request.description.trim()
        : null,
      permissionKeys: request.permissionKeys,
    })
    const parsed = roleResponseSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "peopleAccess.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.createRole")
  }
}

export async function patchRole(
  roleId: string,
  request: {
    name?: string
    description?: string | null
    permissionKeys?: string[]
  },
): Promise<RoleResponse> {
  try {
    const response = await api.patch<unknown>(`${ROLES_PATH}/${roleId}`, request)
    const parsed = roleResponseSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "peopleAccess.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.updateRole")
  }
}

export async function replaceRolePermissions(
  roleId: string,
  permissionKeys: string[],
): Promise<RoleResponse> {
  try {
    const response = await api.put<unknown>(`${ROLES_PATH}/${roleId}/permissions`, {
      permissionKeys,
    })
    const parsed = roleResponseSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "peopleAccess.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.updateRole")
  }
}

export async function deleteRole(roleId: string): Promise<void> {
  try {
    await api.delete(`${ROLES_PATH}/${roleId}`)
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.deleteRole")
  }
}

export async function listPermissions(): Promise<PermissionCatalogItemDto[]> {
  try {
    const response = await api.get<unknown>(PERMISSIONS_PATH)
    const parsed = permissionCatalogListSchema.safeParse(response.data)
    return parseOrThrow(
      parsed.success,
      parsed.success ? parsed.data : undefined,
      "peopleAccess.errors.invalidResponse",
    )
  } catch (error: unknown) {
    throwRbacServiceError(error, "peopleAccess.errors.loadPermissions")
  }
}
