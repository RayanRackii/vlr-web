import i18n from "@/lib/i18n"
import { getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"

export const RBAC_ERROR_CODES = [
  "PRIVILEGE_ESCALATION_BLOCKED",
  "LAST_ADMIN_PROTECTED",
  "ROLE_IN_USE",
  "CANNOT_MODIFY_SYSTEM_ROLE",
  "CANNOT_DELETE_SYSTEM_ROLE",
  "CANNOT_ASSIGN_SUPERADMIN",
  "FORBIDDEN",
] as const

export type RbacErrorCode = (typeof RBAC_ERROR_CODES)[number]

const RBAC_ERROR_CODE_SET = new Set<string>(RBAC_ERROR_CODES)

export function isRbacErrorCode(value: string): value is RbacErrorCode {
  return RBAC_ERROR_CODE_SET.has(value)
}

export function mapRbacErrorMessage(rawError: string, fallback: string): string {
  if (isRbacErrorCode(rawError)) {
    return i18n.t(`rbac.errors.${rawError}`)
  }

  if (rawError.trim().length > 0) {
    return rawError
  }

  return fallback
}

export function throwRbacServiceError(
  error: unknown,
  fallbackKey: string,
): never {
  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  const fallback = i18n.t(fallbackKey)
  const raw = parseApiError(getAxiosErrorPayload(error), "")
  throw new Error(mapRbacErrorMessage(raw, fallback))
}
