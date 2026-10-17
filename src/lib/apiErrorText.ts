export const UNEXPECTED_API_ERROR = "An unexpected error occurred."

export type ApiErrorBody = {
  code: string | null
  error: string | null
}

export function readApiErrorBody(payload: unknown): ApiErrorBody {
  if (typeof payload !== "object" || payload === null) {
    return { code: null, error: null }
  }

  const record = payload as Record<string, unknown>
  return {
    code: typeof record.code === "string" ? record.code : null,
    error: typeof record.error === "string" ? record.error : null,
  }
}

export function isUnexpectedApiError(message: string | null | undefined): boolean {
  return message?.trim() === UNEXPECTED_API_ERROR
}
