import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  readPlatformTenantExitedUserId,
  subscribePlatformTenantExit,
} from "@/features/admin/lib/platformTenantExit"
import { hasPermission } from "@/features/users/permissions/hasPermission"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import { staffSessionFingerprint } from "@/features/users/services/currentUserCache"
import { getCurrentUser } from "@/features/users/services/usersService"

export type PermissionContextValue = {
  currentUser: CurrentUser | null
  permissions: readonly string[]
  activeModules: readonly string[]
  isLoading: boolean
  error: string | null
  can: (permission: string) => boolean
  refresh: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

function profileTenantId(profile: CurrentUser | null): string {
  return profile?.tenantId?.trim() ?? ""
}

function buildValue(
  currentUser: CurrentUser | null,
  isLoading: boolean,
  error: string | null,
  refresh: () => Promise<void>,
): PermissionContextValue {
  const permissions = currentUser?.permissions ?? []
  const activeModules = currentUser?.activeModules ?? []

  return {
    currentUser,
    permissions,
    activeModules,
    isLoading,
    error,
    can: (permission: string) => hasPermission(permissions, permission),
    refresh,
  }
}

type PermissionProviderProps = {
  children: ReactNode
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { user } = useAuth()
  const exitedUserId = useSyncExternalStore(
    subscribePlatformTenantExit,
    readPlatformTenantExitedUserId,
    () => null,
  )
  const sessionFingerprint = staffSessionFingerprint(user, exitedUserId)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [appliedFingerprint, setAppliedFingerprint] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)
  const seenFingerprintRef = useRef<string | null>(null)
  const mismatchRetryRef = useRef<string | null>(null)
  const sessionFingerprintRef = useRef(sessionFingerprint)
  sessionFingerprintRef.current = sessionFingerprint

  const load = useCallback(async (force = false) => {
    const requestId = ++loadGenerationRef.current
    const requestedFingerprint = sessionFingerprintRef.current
    setIsLoading(true)
    setError(null)

    try {
      let profile = await getCurrentUser(force ? { force: true } : undefined)
      if (requestId !== loadGenerationRef.current) {
        return
      }
      const actingTenant = requestedFingerprint.slice(requestedFingerprint.indexOf("|") + 1)
      const profileIsForAnotherTenant = actingTenant.length > 0
        && profileTenantId(profile) !== actingTenant
      if (profileIsForAnotherTenant && mismatchRetryRef.current !== requestedFingerprint) {
        mismatchRetryRef.current = requestedFingerprint
        profile = await getCurrentUser({ force: true })
        if (requestId !== loadGenerationRef.current) {
          return
        }
      }
      setCurrentUser(profile)
      setAppliedFingerprint(requestedFingerprint)
    } catch (caught: unknown) {
      if (requestId !== loadGenerationRef.current) {
        return
      }
      setCurrentUser(null)
      setAppliedFingerprint(requestedFingerprint)
      setError(caught instanceof Error ? caught.message : null)
    } finally {
      if (requestId === loadGenerationRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const refresh = useCallback(async () => {
    await load(true)
  }, [load])

  useEffect(() => {
    const identityChanged =
      seenFingerprintRef.current !== null &&
      seenFingerprintRef.current !== sessionFingerprint
    seenFingerprintRef.current = sessionFingerprint
    void load(identityChanged)
  }, [load, sessionFingerprint])

  const value = useMemo(
    () => {
      const profilePending = appliedFingerprint !== sessionFingerprint
      return buildValue(
        profilePending ? null : currentUser,
        isLoading || profilePending,
        profilePending ? null : error,
        refresh,
      )
    },
    [appliedFingerprint, currentUser, error, isLoading, refresh, sessionFingerprint],
  )

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

type TestPermissionProviderProps = {
  children: ReactNode
  permissions?: readonly string[]
  activeModules?: readonly string[]
  isLoading?: boolean
  currentUser?: CurrentUser | null
}

export function TestPermissionProvider({
  children,
  permissions = [],
  activeModules = [],
  isLoading = false,
  currentUser = null,
}: TestPermissionProviderProps) {
  const profile = useMemo<CurrentUser | null>(() => {
    if (currentUser) {
      return currentUser
    }

    if (permissions.length === 0 && activeModules.length === 0) {
      return null
    }

    return {
      id: null,
      fullName: "Test",
      email: "test@example.com",
      role: "USER",
      tenantId: null,
      activeModules: [...activeModules],
      activeAssetFamilies: [],
      isTrial: false,
      isTrialReadOnly: false,
      notificationsEmailOnly: false,
      roles: [],
      permissions: [...permissions],
    }
  }, [activeModules, currentUser, permissions])

  const value = useMemo(
    () =>
      buildValue(profile, isLoading, null, async () => {
        return
      }),
    [isLoading, profile],
  )

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext)

  if (context === null) {
    throw new Error("usePermissions must be used within a PermissionProvider.")
  }

  return context
}

/**
 * Non-throwing variant for chrome that may mount outside a PermissionProvider
 * (e.g. the staff header bell rendered by AppShell in isolation tests). Returns
 * null when there is no provider so the caller can degrade quietly.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalPermissions(): PermissionContextValue | null {
  return useContext(PermissionContext)
}

export function useCan(permission: string): boolean {
  const { can } = usePermissions()
  return can(permission)
}
