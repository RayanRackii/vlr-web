import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import {
  getEmailInitials,
  getPageTitleKey,
} from "@/components/layout/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useSupportTenant } from "@/features/admin/support/SupportTenantProvider"
import { supabase } from "@/lib/supabase"

export function MainLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isSupportMode, supportTenant, exitSupport } = useSupportTenant()

  const userEmail = user?.email ?? t("account.userFallback")
  const pageTitle = t(getPageTitleKey(location.pathname))
  const initials = getEmailInitials(user?.email)

  return (
    <AppShell
      sidebar={({ onNavigate }) => <Sidebar onNavigate={onNavigate} />}
      pageTitle={pageTitle}
      userLabel={userEmail}
      initials={initials}
      banner={
        isSupportMode && supportTenant ? (
          <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100">
            <p className="min-w-0 truncate">
              {t("admin.support.banner", { tenant: supportTenant.legalName })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-600/40 bg-background/80"
              onClick={() => {
                exitSupport()
              }}
            >
              {t("admin.support.exit")}
            </Button>
          </div>
        ) : null
      }
      onSignOut={async () => {
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
