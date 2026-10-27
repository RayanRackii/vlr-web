import { Navigate, Outlet, useLocation } from "react-router-dom"
import type { ReactNode } from "react"

import { useAuth } from "@/contexts/AuthContext"
import {
  getCustomerSubdomain,
  isCustomerSignedInForTenant,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  isSafeStaffNextPath,
  staffLoginPath,
} from "@/lib/safeStaffNextPath"
import { isAuthenticatedRestoreBlocked } from "@/lib/sessionRestoreGuard"

type ProtectedRouteProps = {
  children?: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isAuthenticatedRestoreBlocked()) {
    return null
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    )
  }

  if (user === null) {
    const customerSubdomain = getCustomerSubdomain()
    if (customerSubdomain && isCustomerSignedInForTenant(customerSubdomain)) {
      return <Navigate to={tenantPortalPath(customerSubdomain, "app")} replace />
    }

    const company = new URLSearchParams(location.search).get("company")
    const next = `${location.pathname}${location.search}`
    const to = isSafeStaffNextPath(next)
      ? staffLoginPath(next, { company })
      : company
        ? `/login?company=${encodeURIComponent(company)}`
        : "/login"
    return <Navigate to={to} replace />
  }

  return children ?? <Outlet />
}
