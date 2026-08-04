import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import {
  getEmailInitials,
  getPageTitleKey,
} from "@/components/layout/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

export function MainLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const userEmail = user?.email ?? t("account.userFallback")
  const pageTitle = t(getPageTitleKey(location.pathname))
  const initials = getEmailInitials(user?.email)

  return (
    <AppShell
      sidebar={({ onNavigate }) => <Sidebar onNavigate={onNavigate} />}
      pageTitle={pageTitle}
      userLabel={userEmail}
      initials={initials}
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
