export type AuthSessionLogEvent =
  | "SIGNED_IN"
  | "TOKEN_REFRESHED"
  | "SIGNED_OUT"
  | "GET_SESSION"
  | "API_401"

export type AuthSessionSurface = "b2b" | "b2c"

export type AuthSessionLogInput = {
  event: AuthSessionLogEvent
  surface: AuthSessionSurface
  hadSession: boolean
  expiresAt?: number | null
  error?: unknown
  /** Used when the auth library did not return its own HTTP status. */
  httpStatus?: number | null
  requestPath?: string | null
}

const MAX_JWT_SEGMENT_LENGTH = 8192

function expiresInSeconds(expiresAt: number | null | undefined): number | null {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return null
  }

  return Math.round(expiresAt - Date.now() / 1000)
}

function readAuthError(error: unknown): {
  errorName: string | null
  errorStatus: number | null
  errorCode: string | null
} {
  if (typeof error !== "object" || error === null) {
    return { errorName: null, errorStatus: null, errorCode: null }
  }

  const record = error as {
    name?: unknown
    status?: unknown
    code?: unknown
  }

  return {
    errorName: typeof record.name === "string" ? record.name : null,
    errorStatus:
      typeof record.status === "number" && Number.isFinite(record.status)
        ? record.status
        : null,
    errorCode: typeof record.code === "string" ? record.code : null,
  }
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  )
  return atob(padded)
}

/** Reads only the numeric `exp` claim. Other JWT claims are discarded. */
export function readJwtExpiresAt(
  authorizationOrToken: string | null | undefined,
): number | null {
  if (typeof authorizationOrToken !== "string") {
    return null
  }

  const token = authorizationOrToken.replace(/^Bearer\s+/i, "").trim()
  const payload = token.split(".")[1]
  if (!payload || payload.length > MAX_JWT_SEGMENT_LENGTH) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(payload))
    if (typeof parsed !== "object" || parsed === null || !("exp" in parsed)) {
      return null
    }

    const exp = parsed.exp
    return typeof exp === "number" && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

export function requestPathWithoutQuery(
  url: string | null | undefined,
): string | null {
  if (typeof url !== "string") {
    return null
  }

  const trimmed = url.trim()
  if (trimmed.length === 0) {
    return null
  }

  const withoutFragment = trimmed.split("#")[0] ?? trimmed
  const withoutQuery = withoutFragment.split("?")[0] ?? withoutFragment
  if (/^https?:\/\//i.test(withoutQuery)) {
    try {
      return new URL(withoutQuery).pathname
    } catch {
      return withoutQuery
    }
  }

  return withoutQuery
}

/**
 * One JSON line. Callers must pass only the fields above — never a session,
 * header, token, email, phone, or customer id.
 */
export function logAuthSessionEvent(input: AuthSessionLogInput): void {
  const authError = readAuthError(input.error)
  const line = {
    event: input.event,
    surface: input.surface,
    hadSession: input.hadSession,
    expiresInSec: expiresInSeconds(input.expiresAt),
    errorName: authError.errorName,
    errorStatus: authError.errorStatus ?? input.httpStatus ?? null,
    errorCode: authError.errorCode,
    requestPath: requestPathWithoutQuery(input.requestPath),
  }

  console.info(JSON.stringify(line))
}
