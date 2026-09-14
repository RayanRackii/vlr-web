import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { hasPermission } from "@/features/users/permissions/hasPermission"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
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
  const { isInTenantEnvironment } = usePlatformTenantSession()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)
  const tenantEnvRef = useRef<boolean | null>(null)

  const load = useCallback(async (force = false) => {
    const requestId = ++loadGenerationRef.current
    setIsLoading(true)
    setError(null)

    try {
      const profile = await getCurrentUser(force ? { force: true } : undefined)
      if (requestId !== loadGenerationRef.current) {
        return
      }
      setCurrentUser(profile)
    } catch (caught: unknown) {
      if (requestId !== loadGenerationRef.current) {
        return
      }
      setCurrentUser(null)
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
    const tenantChanged =
      tenantEnvRef.current !== null &&
      tenantEnvRef.current !== isInTenantEnvironment
    tenantEnvRef.current = isInTenantEnvironment
    void load(tenantChanged)
  }, [isInTenantEnvironment, load])

  const value = useMemo(
    () => buildValue(currentUser, isLoading, error, refresh),
    [currentUser, error, isLoading, refresh],
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

export function useCan(permission: string): boolean {
  const { can } = usePermissions()
  return can(permission)
}
