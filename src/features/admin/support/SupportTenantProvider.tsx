import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import {
  readSupportTenantSession,
  writeSupportTenantSession,
  type SupportTenantSession,
} from "@/features/admin/support/supportTenantSession"

type SupportTenantContextValue = {
  supportTenant: SupportTenantSession | null
  isSupportMode: boolean
  exitSupport: () => void
}

const SupportTenantContext = createContext<SupportTenantContextValue | null>(
  null,
)

export function SupportTenantProvider({ children }: { children: ReactNode }) {
  const { isLoading: isAuthLoading } = useAuth()
  const isPlatformAdmin = useIsPlatformAdmin()
  const location = useLocation()
  const navigate = useNavigate()
  const [supportTenant, setSupportTenant] = useState<SupportTenantSession | null>(
    () => readSupportTenantSession(),
  )

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!isPlatformAdmin) {
      writeSupportTenantSession(null)
      setSupportTenant(null)
      return
    }

    const params = new URLSearchParams(location.search)
    const id = params.get("supportTenantId")?.trim()
    const legalName =
      params.get("supportTenantName")?.trim() || id || "Tenant"

    if (id) {
      const session = { id, legalName }
      writeSupportTenantSession(session)
      setSupportTenant(session)

      params.delete("supportTenantId")
      params.delete("supportTenantName")
      const search = params.toString()
      void navigate(
        {
          pathname: location.pathname,
          search: search.length > 0 ? `?${search}` : "",
        },
        { replace: true },
      )
      return
    }

    setSupportTenant(readSupportTenantSession())
  }, [
    isAuthLoading,
    isPlatformAdmin,
    location.pathname,
    location.search,
    navigate,
  ])

  const exitSupport = useCallback(() => {
    writeSupportTenantSession(null)
    setSupportTenant(null)
    void navigate("/admin/dashboard", { replace: true })
  }, [navigate])

  const value = useMemo<SupportTenantContextValue>(
    () => ({
      supportTenant: isPlatformAdmin ? supportTenant : null,
      isSupportMode: Boolean(isPlatformAdmin && supportTenant),
      exitSupport,
    }),
    [exitSupport, isPlatformAdmin, supportTenant],
  )

  return (
    <SupportTenantContext.Provider value={value}>
      {children}
    </SupportTenantContext.Provider>
  )
}

export function useSupportTenant(): SupportTenantContextValue {
  const context = useContext(SupportTenantContext)

  if (!context) {
    return {
      supportTenant: null,
      isSupportMode: false,
      exitSupport: () => undefined,
    }
  }

  return context
}
