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

export function describeApiError(error: unknown, fallback: string): string {
  if (isAxiosError(error) && error.response?.status === 403) {
    const raw = parseApiError(getAxiosErrorPayload(error), "FORBIDDEN")
    return mapRbacErrorMessage(
      raw.trim().length > 0 ? raw : "FORBIDDEN",
      i18n.t("rbac.errors.FORBIDDEN"),
    )
  }

  if (error instanceof Error && !isAxiosError(error)) {
    return mapRbacErrorMessage(error.message, fallback)
  }

  const raw = parseApiError(getAxiosErrorPayload(error), "")
  return mapRbacErrorMessage(raw, fallback)
}

export function isForbiddenError(error: unknown): boolean {
  if (isAxiosError(error) && error.response?.status === 403) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message === "FORBIDDEN" ||
    error.message === i18n.t("rbac.errors.FORBIDDEN")
  )
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
