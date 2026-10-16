import { useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/layout/Sidebar"
import { staffHeaderContextLabel } from "@/components/layout/staffHeaderContextLabel"
import { StaffHomeRedirectNotice } from "@/components/layout/StaffHomeRedirectNotice"
import { TrialBanner } from "@/components/layout/TrialBanner"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  getEmailInitials,
  getPageTitleKey,
  RENTAL_RESOURCES_PERMISSIONS,
} from "@/components/layout/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { PermissionProvider, usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  clearPlatformTenantExited,
  markPlatformTenantExited,
  refreshAuthSession,
  usePlatformTenantSession,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { exitTenantEnvironment } from "@/features/admin/services/adminTenantsService"
import { invalidateCurrentUserCache } from "@/features/users/services/currentUserCache"
import { supabase } from "@/lib/supabase"

function MainLayoutShell() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isPlatformAdmin, isInTenantEnvironment, activeTenantLabel } =
    usePlatformTenantSession()
  const { can, currentUser, isLoading: permissionsLoading } = usePermissions()
  const [isExiting, setIsExiting] = useState(false)
  const resourcesAccess =
    location.pathname === "/configuracoes/recursos"
      ? resolvePermissionRouteAccess({
          isLoading: permissionsLoading,
          hasPermission: RENTAL_RESOURCES_PERMISSIONS.every((key) => can(key)),
          isPlatformAdminOutsideTenant:
            isPlatformAdmin && !isInTenantEnvironment,
          permission: RENTAL_RESOURCES_PERMISSIONS[0] ?? "",
        })
      : null

  if (resourcesAccess === "loading" || resourcesAccess === "deny") {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        {resourcesAccess === "loading" ? (
          <PageContentSkeleton rows={3} />
        ) : (
          <AccessDeniedPage />
        )}
      </main>
    )
  }

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
      if (user?.id) {
        markPlatformTenantExited(user.id)
      } else {
        writeActiveTenantLabel(null)
      }

      try {
        await refreshAuthSession()
      } catch {
        // POST /exit already cleared the server tenant. A failed token refresh
        // must not leave the platform admin inside the tenant shell.
      }

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
      contextLabel={staffHeaderContextLabel(
        currentUser,
        t("app.authenticatedArea"),
      )}
      banner={
        <>
          <StaffHomeRedirectNotice />
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
        invalidateCurrentUserCache()
        const { error } = await supabase.auth.signOut()
        if (error !== null) {
          return
        }
        clearPlatformTenantExited()
        void navigate("/login", { replace: true })
      }}
    >
      <Outlet />
    </AppShell>
  )
}

export function MainLayout() {
  return (
    <PermissionProvider>
      <MainLayoutShell />
    </PermissionProvider>
  )
}
