import { Navigate, Outlet } from "react-router-dom"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { useAuth } from "@/contexts/AuthContext"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"

type PlatformAdminRouteProps = {
  children?: ReactNode
}

export function PlatformAdminRoute({ children }: PlatformAdminRouteProps) {
  const { t } = useTranslation()
  const { user, isLoading } = useAuth()
  const isPlatformAdmin = useIsPlatformAdmin()

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </main>
    )
  }

  if (user === null) {
    return <Navigate to="/login" replace />
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children ?? <Outlet />
}
