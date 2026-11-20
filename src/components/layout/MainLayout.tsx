import { Suspense, useContext, useEffect, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary"
import { AppShell } from "@/components/layout/AppShell"
import { ModuleIntroLinksProvider } from "@/components/layout/ModuleIntroLinksContext"
import { availableModuleIntros } from "@/components/layout/navigationIntros"
import { Sidebar } from "@/components/layout/Sidebar"
import { Breadcrumb } from "@/components/layout/Breadcrumb"
import { BreadcrumbTitleProvider } from "@/components/layout/BreadcrumbTitleProvider"
import { staffHeaderContextLabel } from "@/components/layout/staffHeaderContextLabel"
import { StaffHomeRedirectNotice } from "@/components/layout/StaffHomeRedirectNotice"
import { TrialBanner } from "@/components/layout/TrialBanner"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  getPageTitleKey,
  getUserDisplayLabel,
  getUserInitials,
  RENTAL_RESOURCES_PERMISSIONS,
  useAppNavigationSections,
} from "@/components/layout/navigation"
import { cadastroArea, isCadastroFocusPath } from "@/features/assistant/useCadastroStep"
import { useAuth } from "@/contexts/AuthContext"
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"
import {
  fetchTenantBranding,
  getHostTenantSubdomain,
} from "@/features/tenantPortal/services/tenantPortalService"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { BreadcrumbTitleContext } from "@/components/layout/useBreadcrumbTitle"
import { useTenantDocumentMeta } from "@/hooks/useTenantDocumentMeta"
import { resolvePermissionRouteAccess } from "@/features/users/permissions/permissionGroups"
import { ModuleInactivePage } from "@/components/layout/ModuleInactivePage"
import { PermissionProvider, usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  markPlatformTenantExited,
  refreshAuthSession,
  usePlatformTenantSession,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { exitTenantEnvironment } from "@/features/admin/services/adminTenantsService"
import { WorkOrderSyncHost } from "@/features/workOrders/components/WorkOrderSyncHost"
import { clearCustomerSessionAsSignedOut, signOutStaffPortal } from "@/lib/sessionRestoreGuard"

/** Cadastro wizard breadcrumb: Catálogo › Produtos › Novo produto / name (or Configurações › Recursos › name). */
function CadastroFocusCrumbs() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { title } = useContext(BreadcrumbTitleContext)
  const products = cadastroArea(pathname) === "produtos"
  const creating = /^\/(?:catalogo\/produtos|configuracoes\/recursos)\/cadastro\/?$/.test(pathname)
  const current = title?.pathname === pathname ? title.value : t(creating ? "cadastro.productCreate" : "nav.details")
  const crumbs: { label: string; to?: string }[] = products
    ? [{ label: t("cadastro.crumbCatalog") }, { label: t("nav.catalogProducts"), to: "/catalogo/produtos" }]
    : [{ label: t("nav.sections.settings") }, { label: t("nav.rentalsResources"), to: "/configuracoes/recursos" }]
  return (
    <nav aria-label={t("nav.breadcrumbLabel")} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {crumbs.map((crumb) => (
          <li key={crumb.label} className="flex shrink-0 items-center gap-2">
            {crumb.to ? <Link to={crumb.to} className="touch-target inline-flex items-center hover:text-foreground hover:underline">{crumb.label}</Link> : <span>{crumb.label}</span>}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </li>
        ))}
        <li className="min-w-0 truncate font-medium text-foreground" aria-current="page">{current}</li>
      </ol>
    </nav>
  )
}

function MainLayoutShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isPlatformAdmin, isInTenantEnvironment, activeTenantLabel } =
    usePlatformTenantSession()
  const { can, currentUser, activeModules, isLoading: permissionsLoading } = usePermissions()
  const { sections } = useAppNavigationSections("module-intros")
  const introKeys = availableModuleIntros(sections).map((intro) => intro.key)
  const [isExiting, setIsExiting] = useState(false)
  const [hostBranding, setHostBranding] = useState<TenantBranding | null>(null)
  // The staff /me payload has no tenant slug; the tenant host's subdomain is the only source.
  const [hostSubdomain] = useState(() => getHostTenantSubdomain())
  useEffect(() => {
    if (!hostSubdomain) {
      return
    }
    let cancelled = false
    fetchTenantBranding(hostSubdomain)
      .then((branding) => {
        if (!cancelled) setHostBranding(branding)
      })
      .catch(() => {
        // Tab meta is cosmetic; keep the name/letter fallback.
      })
    return () => {
      cancelled = true
    }
  }, [hostSubdomain])
  const staffTenantName = staffHeaderContextLabel(currentUser, "")
  const pageTitleKey = getPageTitleKey(location.pathname)
  const documentPageTitle = pageTitleKey === "app.name" ? null : t(pageTitleKey)
  useTenantDocumentMeta(
    staffTenantName || hostSubdomain
      ? {
          slug: hostBranding?.subdomain || hostSubdomain,
          name: staffTenantName,
          logoSvg: hostBranding?.logoSvg,
          primaryColor: hostBranding?.primaryColor,
          pageTitle: documentPageTitle,
        }
      : null,
  )
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
        ) : activeModules.includes("rentals") ? (
          <AccessDeniedPage />
        ) : (
          <ModuleInactivePage />
        )}
      </main>
    )
  }

  const userLabel = getUserDisplayLabel(
    currentUser?.fullName,
    user?.email,
    t("account.userFallback"),
  )
  const pageTitle = t(pageTitleKey)
  const cadastro = isCadastroFocusPath(location.pathname)
  const initials = getUserInitials(currentUser?.fullName, user?.email)
  const onPlatformPanel = isPlatformAdmin && location.pathname.startsWith("/admin")
  // The first tenant role name labels the user card; the platform panel has no tenant role.
  const roleLabel = onPlatformPanel ? undefined : currentUser?.roles?.[0]?.name
  const workspaceName = staffHeaderContextLabel(
    currentUser,
    activeTenantLabel ?? t("app.authenticatedArea"),
  )

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
    <ModuleIntroLinksProvider keys={introKeys}>
    <AppShell
      sidebar={(opts) => (
        <Sidebar
          {...opts}
          workspaceName={workspaceName}
          platformWorkspace={onPlatformPanel}
        />
      )}
      pageTitle={pageTitle}
      userLabel={userLabel}
      initials={initials}
      profileTo="/perfil"
      collapsible
      constrainContent
      enlargeHeaderTargets
      userEmail={currentUser?.email ?? user?.email ?? undefined}
      userRoleLabel={roleLabel}
      headerStart={
        cadastro ? <CadastroFocusCrumbs /> : <Breadcrumb
          variant="header"
          fallback={
            <p className="hidden min-w-0 truncate text-sm font-medium text-foreground lg:block">
              {pageTitle}
            </p>
          }
        />
      }
      banner={
        <>
          <StaffHomeRedirectNotice />
          <TrialBanner informational={!isPlatformAdmin && location.pathname === "/dashboard"} />
          {onPlatformPanel || isInTenantEnvironment ? (
            <div
              data-testid="super-admin-banner"
              className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground lg:px-8"
            >
              <p className="min-w-0 truncate">
                {onPlatformPanel
                  ? t("admin.support.platformPanel")
                  : t("admin.support.bannerSlim")}
              </p>
              {onPlatformPanel ? null : (
                <button
                  type="button"
                  disabled={isExiting}
                  className="touch-target shrink-0 text-xs font-medium text-primary hover:underline disabled:opacity-60"
                  onClick={() => {
                    void handleExitEnvironment()
                  }}
                >
                  {isExiting
                    ? t("admin.support.exiting")
                    : t("admin.support.exitShort")}
                </button>
              )}
            </div>
          ) : null}
        </>
      }
      onSignOut={async () => {
        // Sair ends whichever session is active, so a leftover customer session goes too.
        clearCustomerSessionAsSignedOut()
        // Always ends the local session (storage first, bounded server revoke).
        await signOutStaffPortal()
        void navigate("/login", { replace: true })
      }}
    >
      <WorkOrderSyncHost />
      {/* Below lg the breadcrumb stays in the content (the top-bar one is lg+ only). */}
      <div data-shell-part="content-breadcrumb" className="lg:hidden">
        {cadastro ? <CadastroFocusCrumbs /> : <Breadcrumb />}
      </div>
      <AppErrorBoundary key={location.pathname}>
        <Suspense fallback={<PageContentSkeleton rows={3} />}>
          {children ?? <Outlet />}
        </Suspense>
      </AppErrorBoundary>
    </AppShell>
    </ModuleIntroLinksProvider>
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
        <BreadcrumbTitleProvider>
          <MainLayoutShell>{children}</MainLayoutShell>
        </BreadcrumbTitleProvider>
      </StaffTenantTimeZoneProvider>
    </PermissionProvider>
  )
}
