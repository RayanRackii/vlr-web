import { useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import { TrialBanner } from "@/components/layout/TrialBanner"
import {
  getEmailInitials,
  getPageTitleKey,
} from "@/components/layout/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import {
  refreshAuthSession,
  usePlatformTenantSession,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { exitTenantEnvironment } from "@/features/admin/services/adminTenantsService"
import { supabase } from "@/lib/supabase"

export function MainLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isInTenantEnvironment, activeTenantLabel } = usePlatformTenantSession()
  const [isExiting, setIsExiting] = useState(false)

  const userEmail = user?.email ?? t("account.userFallback")
  const pageTitle = t(getPageTitleKey(location.pathname))
  const initials = getEmailInitials(user?.email)

  async function handleExitEnvironment() {
    if (isExiting) {
      return
    }

    setIsExiting(true)
    try {
      await exitTenantEnvironment()
      writeActiveTenantLabel(null)
      await refreshAuthSession()
      void navigate("/admin/dashboard", { replace: true })
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.support.exitFailed")
      toast.error(t("admin.support.exitErrorTitle"), { description: message })
    } finally {
      setIsExiting(false)
    }
  }

  return (
    <AppShell
      sidebar={({ onNavigate }) => <Sidebar onNavigate={onNavigate} />}
      pageTitle={pageTitle}
      userLabel={userEmail}
      initials={initials}
      banner={
        <>
          <TrialBanner />
          {isInTenantEnvironment ? (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
            <p className="min-w-0 truncate">
              {t("admin.support.banner", {
                tenant: activeTenantLabel ?? t("admin.support.tenantFallback"),
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExiting}
              className="shrink-0 border-amber-600/40 bg-background/80"
              onClick={() => {
                void handleExitEnvironment()
              }}
            >
              {isExiting
                ? t("admin.support.exiting")
                : t("admin.support.exit")}
            </Button>
          </div>
          ) : null}
        </>
      }
      onSignOut={async () => {
        writeActiveTenantLabel(null)
        const { error } = await supabase.auth.signOut()
        if (error !== null) {
          return
        }
        void navigate("/login", { replace: true })
      }}
    >
      <Outlet />
    </AppShell>
  )
}
