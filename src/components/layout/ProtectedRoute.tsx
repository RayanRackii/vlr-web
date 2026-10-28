import { Navigate, Outlet, useLocation } from "react-router-dom"
import type { ReactNode } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"
import {
  isSafeStaffNextPath,
  staffLoginPath,
} from "@/lib/safeStaffNextPath"
import {
  isAuthenticatedRestoreBlocked,
  signedInCustomerSubdomain,
} from "@/lib/sessionRestoreGuard"

type ProtectedRouteProps = {
  children?: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, expiredSession } = useAuth()
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

  // A customer session is never shown the admin shell, even if a staff session lingers.
  const customerSubdomain = signedInCustomerSubdomain()
  if (customerSubdomain) {
    return <Navigate to={tenantPortalPath(customerSubdomain, "app")} replace />
  }

  if (user === null) {

    const company = new URLSearchParams(location.search).get("company")
    const next = `${location.pathname}${location.search}${location.hash}`
    const to = isSafeStaffNextPath(next)
      ? staffLoginPath(next, {
          company,
          reason: expiredSession ? "session-expired" : null,
          tenant: expiredSession?.tenantId,
        })
      : company
        ? `/login?company=${encodeURIComponent(company)}`
        : "/login"
    return <Navigate to={to} replace />
  }

  return children ?? <Outlet />
}
