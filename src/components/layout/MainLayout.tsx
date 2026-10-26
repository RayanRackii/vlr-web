import { useState, type ReactNode } from "react"
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
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"
import { resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { PermissionProvider, usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  markPlatformTenantExited,
  refreshAuthSession,
  usePlatformTenantSession,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { exitTenantEnvironment } from "@/features/admin/services/adminTenantsService"
import { WorkOrderSyncHost } from "@/features/workOrders/components/WorkOrderSyncHost"
import { signOutStaffPortal } from "@/lib/sessionRestoreGuard"

function MainLayoutShell({ children }: { children?: ReactNode }) {
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
      sidebar={(opts) => <Sidebar {...opts} />}
      pageTitle={pageTitle}
      userLabel={userEmail}
      initials={initials}
      profileTo="/perfil"
      collapsible
      constrainContent
      enlargeHeaderTargets
      contextLabel={staffHeaderContextLabel(
        currentUser,
        t("app.authenticatedArea"),
      )}
      banner={
        <>
          <StaffHomeRedirectNotice />
          <TrialBanner />
          {isPlatformAdmin && location.pathname.startsWith("/admin") ? (
            <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 text-sm text-foreground">
              {t("admin.support.platformPanel")}
            </div>
          ) : isInTenantEnvironment ? (
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
        const signedOut = await signOutStaffPortal()
        if (!signedOut) {
          return
        }
        void navigate("/login", { replace: true })
      }}
    >
      <WorkOrderSyncHost />
      {children ?? <Outlet />}
    </AppShell>
  )
}

function StaffTenantTimeZoneProvider({ children }: { children: ReactNode }) {
  const { currentUser } = usePermissions()

  return (
    <TenantTimeZoneProvider timeZoneId={currentUser?.timeZoneId}>
      {children}
    </TenantTimeZoneProvider>
  )
}

export function MainLayout({ children }: { children?: ReactNode }) {
  return (
    <PermissionProvider>
      <StaffTenantTimeZoneProvider>
        <MainLayoutShell>{children}</MainLayoutShell>
      </StaffTenantTimeZoneProvider>
    </PermissionProvider>
  )
}
