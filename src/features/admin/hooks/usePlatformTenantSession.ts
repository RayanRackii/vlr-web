import { useCallback, useMemo, useSyncExternalStore } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import {
  readPlatformTenantExitedUserId,
  subscribePlatformTenantExit,
  writePlatformTenantExitedUserId,
} from "@/features/admin/lib/platformTenantExit"
import { invalidateCurrentUserCache } from "@/features/users/services/currentUserCache"
import { supabase } from "@/lib/supabase"

const TENANT_LABEL_KEY = "rolvix.activeTenantLabel"

export { readPlatformTenantExitedUserId, subscribePlatformTenantExit }

export function readActiveTenantLabel(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.sessionStorage.getItem(TENANT_LABEL_KEY)
  return value && value.trim().length > 0 ? value : null
}

export function writeActiveTenantLabel(legalName: string | null) {
  if (typeof window === "undefined") {
    return
  }

  if (!legalName) {
    window.sessionStorage.removeItem(TENANT_LABEL_KEY)
    return
  }

  window.sessionStorage.setItem(TENANT_LABEL_KEY, legalName)
}

function readTenantIdFromUser(user: {
  app_metadata?: Record<string, unknown>
} | null): string | null {
  const raw = user?.app_metadata?.tenant_id
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null
}

/** Local UI exit for this user. The JWT claim can lag behind POST /exit. */
export function markPlatformTenantExited(userId: string) {
  writeActiveTenantLabel(null)
  writePlatformTenantExitedUserId(userId)
}

/** Cleared on enter and after a successful sign-out so a later tenant session is visible. */
export function clearPlatformTenantExited() {
  writePlatformTenantExitedUserId(null)
}

export async function refreshAuthSession() {
  invalidateCurrentUserCache()
  const { error } = await supabase.auth.refreshSession()
  if (error) {
    throw error
  }
}

/**
 * Platform Super-Admin inside a tenant product (JWT app_metadata.tenant_id set).
 */
export function usePlatformTenantSession() {
  const { user } = useAuth()
  const isPlatformAdmin = useIsPlatformAdmin()
  const exitedUserId = useSyncExternalStore(
    subscribePlatformTenantExit,
    readPlatformTenantExitedUserId,
    () => null,
  )

  const activeTenantId = useMemo(() => {
    if (!isPlatformAdmin) {
      return null
    }

    const userId = user?.id ?? ""
    if (userId.length > 0 && exitedUserId === userId) {
      return null
    }

    return readTenantIdFromUser(user)
  }, [exitedUserId, isPlatformAdmin, user])

  const isInTenantEnvironment = Boolean(isPlatformAdmin && activeTenantId)

  const activeTenantLabel = useMemo(() => {
    if (!isInTenantEnvironment) {
      return null
    }

    return readActiveTenantLabel()
  }, [isInTenantEnvironment, user])

  const clearTenantLabel = useCallback(() => {
    writeActiveTenantLabel(null)
  }, [])

  return {
    isPlatformAdmin,
    activeTenantId,
    activeTenantLabel,
    isInTenantEnvironment,
    clearTenantLabel,
  }
}
