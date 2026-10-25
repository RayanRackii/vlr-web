export const UNEXPECTED_API_ERROR = "An unexpected error occurred."

export type ApiErrorBody = {
  code: string | null
  error: string | null
  reason: string | null
}

export function readApiErrorBody(payload: unknown): ApiErrorBody {
  if (typeof payload !== "object" || payload === null) {
    return { code: null, error: null, reason: null }
  }

  const record = payload as Record<string, unknown>
  return {
    code: typeof record.code === "string" ? record.code : null,
    error: typeof record.error === "string" ? record.error : null,
    reason: typeof record.reason === "string" ? record.reason : null,
  }
}

export function isUnexpectedApiError(message: string | null | undefined): boolean {
  return message?.trim() === UNEXPECTED_API_ERROR
}

/** Module-inactive 403: current API message ("Module is not active for this tenant.") or a stable code. */
export function isModuleInactiveValue(value: unknown): boolean {
  if (typeof value !== "string") return false
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "")
  return (
    normalized === "module_inactive" ||
    normalized === "module_not_active" ||
    normalized === "module_is_not_active" ||
    normalized === "module_is_not_active_for_this_tenant"
  )
}
