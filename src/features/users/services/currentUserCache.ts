import type { CurrentUser } from "@/features/users/schemas/userSchemas"

type CurrentUserLoader = () => Promise<CurrentUser>

type AuthUserLike = {
  id?: string | null
  app_metadata?: Record<string, unknown>
} | null | undefined

let generation = 0
let cached: CurrentUser | null = null
let inflight: Promise<CurrentUser> | null = null
let lastFingerprint: string | null = null

/** `userId|tenantId` — identity + tenant environment for cache lifetime. */
export function currentUserSessionFingerprint(user: AuthUserLike): string {
  const id = user?.id?.trim() ?? ""
  const tenantRaw = user?.app_metadata?.tenant_id
  const tenantId = typeof tenantRaw === "string" ? tenantRaw.trim() : ""
  return `${id}|${tenantId}`
}

export function invalidateCurrentUserCache(): void {
  generation += 1
  cached = null
  inflight = null
}

/**
 * Drops the cached `/me` profile when the authenticated identity or JWT tenant
 * changes (login, logout, tenant enter/exit). Same fingerprint is a no-op so
 * token refresh does not refetch.
 */
export function syncCurrentUserCacheToAuthUser(user: AuthUserLike): void {
  const next = currentUserSessionFingerprint(user)
  if (lastFingerprint === next) {
    return
  }

  lastFingerprint = next
  invalidateCurrentUserCache()
}

export function resetCurrentUserCacheForTests(): void {
  generation = 0
  cached = null
  inflight = null
  lastFingerprint = null
}

export function peekCurrentUserCacheForTests(): CurrentUser | null {
  return cached
}

export async function readCurrentUser(
  loader: CurrentUserLoader,
): Promise<CurrentUser> {
  if (cached) {
    return cached
  }

  if (inflight) {
    return inflight
  }

  const startedAt = generation
  inflight = (async () => {
    try {
      const profile = await loader()
      if (startedAt !== generation) {
        return readCurrentUser(loader)
      }
      cached = profile
      return profile
    } catch (error: unknown) {
      if (startedAt !== generation) {
        return readCurrentUser(loader)
      }
      throw error
    } finally {
      if (startedAt === generation) {
        inflight = null
      }
    }
  })()

  return inflight
}
