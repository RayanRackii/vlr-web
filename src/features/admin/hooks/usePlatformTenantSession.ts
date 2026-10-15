import { useCallback, useMemo, useSyncExternalStore } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import { invalidateCurrentUserCache } from "@/features/users/services/currentUserCache"
import { noteEstablishedStaffSession } from "@/lib/api"
import { supabase } from "@/lib/supabase"

const TENANT_LABEL_KEY = "rolvix.activeTenantLabel"
const EXITED_USER_KEY = "rolvix.platformTenantExitedUserId"
const EXITED_EVENT = "rolvix:platform-tenant-exited"

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

export function readPlatformTenantExitedUserId(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const value = window.sessionStorage.getItem(EXITED_USER_KEY)
  return value && value.trim().length > 0 ? value : null
}

function notifyPlatformTenantExit() {
  window.dispatchEvent(new Event(EXITED_EVENT))
}

/** Local UI exit for this user. The JWT claim can lag behind POST /exit. */
export function markPlatformTenantExited(userId: string) {
  if (typeof window === "undefined") {
    return
  }

  writeActiveTenantLabel(null)
  const trimmed = userId.trim()
  if (trimmed.length === 0) {
    window.sessionStorage.removeItem(EXITED_USER_KEY)
  } else {
    window.sessionStorage.setItem(EXITED_USER_KEY, trimmed)
  }

  notifyPlatformTenantExit()
}

/** Cleared on enter and after a successful sign-out so a later tenant session is visible. */
export function clearPlatformTenantExited() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(EXITED_USER_KEY)
  notifyPlatformTenantExit()
}

function subscribePlatformTenantExit(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {}
  }

  window.addEventListener(EXITED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(EXITED_EVENT, onStoreChange)
  }
}

export async function refreshAuthSession() {
  invalidateCurrentUserCache()
  const { data, error } = await supabase.auth.refreshSession()
  if (error) {
    throw error
  }

  // Enter/exit tenant saves new claims here. A staff 401 may already be inside
  // refreshSession({ refresh_token }) and can write the previous JWT back.
  noteEstablishedStaffSession(data.session)
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
