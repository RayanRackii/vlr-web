import "./portal/portal.css"

import { X } from "lucide-react"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"
import { AppShell } from "@/components/layout/AppShell"
import { customerDisplayInitials, customerDisplayName } from "@/features/tenantPortal/lib/customerDisplayName"
import { isAxiosError } from "@/lib/api"
import { useTenantThemeCssVars } from "@/lib/useTenantTheme"
import { CustomerNotificationBell } from "./CustomerNotificationBell"
import { CustomerSidebar } from "@/features/tenantPortal/components/CustomerSidebar"
import { useCustomerLabel } from "@/features/tenantPortal/hooks/useCustomerLabel"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"
import { TenantPortalChromeHeader } from "@/features/tenantPortal/components/TenantPortalChromeHeader"
import { getAgendaSessionGeneration } from "@/features/tenantPortal/lib/agendaQueryClient"
import {
  clearAgendaSelectionNotice,
  readAgendaSelectionNotice,
  subscribeAgendaSelectionNotice,
} from "@/features/tenantPortal/lib/agendaSelectionNotice"
import { isCustomerNavItemActive } from "@/features/catalog/customerNavActive"
import { appendReturnToParam } from "@/features/tenantPortal/lib/tenantPortalReturnTo"
import type {
  ModuleMenuItem,
  TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  fetchTenantBranding,
  fetchTenantMenu,
  isCustomerSignedInForTenant,
  resolveTenantSubdomain,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import { buildCustomerShellNavItems } from "@/features/catalog/customerNav"
import appI18n from "@/lib/i18n"
import {
  hasActiveStaffSession,
  isAuthenticatedRestoreBlocked,
  signOutCustomerPortal,
  signOutStaffPortal,
} from "@/lib/sessionRestoreGuard"

export type CustomerAppOutletContext = {
  subdomain: string
  branding: TenantBranding
  primary: string
  menu: ModuleMenuItem[]
}

export function CustomerAppLayout() {
  const { t } = useTranslation()
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const customerLabel = useCustomerLabel()
  const subdomain = useMemo(() => {
    const fromPath = params.subdomain?.toLowerCase()
    if (fromPath) {
      return fromPath
    }
    return resolveTenantSubdomain(window.location.pathname)
  }, [params.subdomain])

  const signedIn =
    subdomain !== null && isCustomerSignedInForTenant(subdomain)
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [menu, setMenu] = useState<ModuleMenuItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticatedRestoreBlocked() || !subdomain || !signedIn) {
      setLoading(false)
      return
    }

    let cancelled = false
    const generation = getAgendaSessionGeneration()
    setLoading(true)
    void Promise.all([
      fetchTenantBranding(subdomain),
      fetchTenantMenu(subdomain),
    ])
      .then(([brandingData, menuData]) => {
        if (cancelled || generation !== getAgendaSessionGeneration()) {
          return
        }
        setBranding(brandingData)
        setMenu(menuData)
        setError(null)
        setNotFound(false)
      })
      .catch((requestError: unknown) => {
        if (!cancelled && generation === getAgendaSessionGeneration()) {
          setError(appI18n.t("tenantPortal.errors.tenantNotFound"))
          setNotFound(
            isAxiosError(requestError) && requestError.response?.status === 404,
          )
          setBranding(null)
          setMenu([])
        }
      })
      .finally(() => {
        if (!cancelled && generation === getAgendaSessionGeneration()) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [subdomain, signedIn])

  const { tokens, style: themeStyle } = useTenantThemeCssVars(
    branding?.primaryColor,
    branding?.accentColor,
  )
  const selectionNotice = useSyncExternalStore(
    subscribeAgendaSelectionNotice,
    () => readAgendaSelectionNotice(subdomain ?? ""),
    () => null,
  )

  if (isAuthenticatedRestoreBlocked()) {
    return null
  }

  if (!signedIn) {
    const loginPath = subdomain ? tenantPortalPath(subdomain) : "/"
    const returnTo = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={subdomain ? appendReturnToParam(loginPath, returnTo) : loginPath}
        replace
      />
    )
  }

  if (!subdomain) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.errors.missingSubdomain")}
        </p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <PageContentSkeleton rows={3} className="w-full max-w-md" />
      </main>
    )
  }

  if (error || !branding) {
    if (notFound && location.pathname.split("/").includes("catalogo")) {
      return (
        <div className="min-h-screen bg-background text-foreground">
          <TenantPortalChromeHeader subdomain={subdomain} portalBasePath={params.subdomain ? `/t/${params.subdomain}` : ""} />
          <main className="flex min-h-screen items-center justify-center p-6 pt-24"><PortalNotFoundRoute /></main>
        </div>
      )
    }
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{error}</p>
      </main>
    )
  }

  const navItems = buildCustomerShellNavItems(subdomain, menu, t)

  const activeItem = navItems.find((item) =>
    isCustomerNavItemActive(item, navItems, location.pathname, location.hash),
  )
  const profileTo = tenantPortalPath(subdomain, "app/perfil")
  const isProfilePage = location.pathname === profileTo
  const pageTitle = isProfilePage
    ? t("tenantPortal.profile.title")
    : (activeItem?.label ?? branding.displayName)
  const userLabel = customerLabel ?? t("account.userFallback")

  return (
    <div className="portal-shell min-h-screen bg-background text-foreground" style={themeStyle}>
      <AppShell
        variant="portal"
        sidebar={({ onNavigate }) => (
          <CustomerSidebar
            brandLabel={branding.displayName}
            logoSvg={branding.logoSvg}
            primaryColor={branding.primaryColor}
            items={navItems}
            userLabel={customerLabel}
            onNavigate={onNavigate}
          />
        )}
        pageTitle={pageTitle}
        userLabel={userLabel}
        initials={customerDisplayInitials(customerDisplayName(userLabel))}
        profileTo={profileTo}
        headerActions={<CustomerNotificationBell subdomain={subdomain} />}
        enlargeHeaderTargets
        showLanguageCode
        banner={
          selectionNotice !== null ? (
            <div
              className="mx-auto flex w-full max-w-4xl items-center gap-3 border-b border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
              role="alert"
            >
              <p className="flex-1 font-medium">
                {t(
                  selectionNotice === "expired"
                    ? "tenantPortal.agenda.selectionExpired"
                    : "tenantPortal.agenda.selectionUnavailable",
                )}
              </p>
              <button
                type="button"
                className="touch-target rounded-sm p-1 hover:bg-amber-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-amber-50/10"
                aria-label={t("common.close")}
                onClick={() => clearAgendaSelectionNotice(subdomain)}
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null
        }
        onSignOut={async () => {
          // Customer storage goes first (sync), then any leftover staff session.
          const path = signOutCustomerPortal(subdomain)
          if (hasActiveStaffSession()) {
            await signOutStaffPortal()
          }
          void navigate(path, { replace: true })
        }}
      >
        <TenantTimeZoneProvider timeZoneId={branding.timeZoneId}>
          <Outlet
            context={
              {
                subdomain,
                branding,
                primary: tokens.primary,
                menu,
              } satisfies CustomerAppOutletContext
            }
          />
        </TenantTimeZoneProvider>
      </AppShell>
    </div>
  )
}
