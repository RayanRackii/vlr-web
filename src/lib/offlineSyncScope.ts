import { del } from "idb-keyval"

/**
 * The offline work-order queue belongs to one signed-in user in one tenant.
 * Storage keys are suffixed with `userId|tenantId` so another user, or the same
 * user in another tenant, never sees or flushes it.
 */
export type OfflineSyncScope = {
  userId: string
  tenantId: string
}

type AuthUserLike = {
  id?: string | null
  app_metadata?: Record<string, unknown>
} | null | undefined

const QUEUE_KEY_PREFIX = "os_sync_queue"
const CONFLICTS_KEY_PREFIX = "os_sync_conflicts"

let currentScope: OfflineSyncScope | null = null
let scopeEpoch = 0
let legacyDropped = false

export function offlineSyncScopeFromUser(user: AuthUserLike): OfflineSyncScope | null {
  const userId = user?.id?.trim() ?? ""
  if (userId.length === 0) {
    return null
  }
  const tenantRaw = user?.app_metadata?.tenant_id
  return { userId, tenantId: typeof tenantRaw === "string" ? tenantRaw.trim() : "" }
}

export function offlineSyncScopeKeys(scope: OfflineSyncScope): { queue: string; conflicts: string } {
  const suffix = `${scope.userId}|${scope.tenantId}`
  return {
    queue: `${QUEUE_KEY_PREFIX}:${suffix}`,
    conflicts: `${CONFLICTS_KEY_PREFIX}:${suffix}`,
  }
}

export function sameOfflineSyncScope(
  a: OfflineSyncScope | null,
  b: OfflineSyncScope | null,
): boolean {
  return a === b || (a !== null && b !== null && a.userId === b.userId && a.tenantId === b.tenantId)
}

export function getOfflineSyncScope(): OfflineSyncScope | null {
  return currentScope
}

/** Bumps on every `setOfflineSyncScope`, including token refreshes of the same identity. */
export function getOfflineSyncScopeEpoch(): number {
  return scopeEpoch
}

/**
 * Called by the auth layer whenever the staff user changes (or refreshes).
 * A null scope keeps stored data (session expiry must not lose edits).
 * Items queued before scoping carry no owner, so they cannot be proven to belong
 * to the current user: the legacy unscoped keys are dropped, never flushed.
 */
export function setOfflineSyncScope(scope: OfflineSyncScope | null): void {
  currentScope = scope
  scopeEpoch += 1
  if (scope !== null && !legacyDropped) {
    legacyDropped = true
    void Promise.all([del(QUEUE_KEY_PREFIX), del(CONFLICTS_KEY_PREFIX)]).catch(() => undefined)
  }
}

/** Explicit sign-out: remove the signed-in scope's queue and conflicts, then forget the scope. */
export async function clearOfflineSyncScope(): Promise<void> {
  const scope = currentScope
  currentScope = null
  scopeEpoch += 1
  if (scope === null) {
    return
  }
  const keys = offlineSyncScopeKeys(scope)
  try {
    await Promise.all([del(keys.queue), del(keys.conflicts)])
  } catch {
    // Storage unavailable: nothing more to clear.
  }
}

export function resetOfflineSyncScopeForTests(): void {
  currentScope = null
  scopeEpoch = 0
  legacyDropped = false
}
