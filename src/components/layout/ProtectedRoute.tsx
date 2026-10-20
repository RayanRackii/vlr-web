import { Navigate, Outlet, useLocation } from "react-router-dom"
import type { ReactNode } from "react"

import { useAuth } from "@/contexts/AuthContext"
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
    const next = `${location.pathname}${location.search}`
    const to = isSafeStaffNextPath(next) ? staffLoginPath(next) : "/login"
    return <Navigate to={to} replace />
  }

  return children ?? <Outlet />
}
