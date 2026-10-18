import { useEffect, useMemo, useState } from "react"
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { AppShell } from "@/components/layout/AppShell"
import { getEmailInitials } from "@/components/layout/navigation"
import { useTenantThemeCssVars } from "@/lib/useTenantTheme"
import { CustomerSidebar } from "@/features/tenantPortal/components/CustomerSidebar"
import { getAgendaSessionGeneration } from "@/features/tenantPortal/lib/agendaQueryClient"
import { isCustomerNavItemActive } from "@/features/catalog/customerNavActive"
import type {
  ModuleMenuItem,
  TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  fetchTenantBranding,
  fetchTenantMenu,
  getCustomerLabel,
  isCustomerSignedInForTenant,
  resolveTenantSubdomain,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import { buildCustomerShellNavItems } from "@/features/catalog/customerNav"
import appI18n from "@/lib/i18n"
import {
  isAuthenticatedRestoreBlocked,
  signOutCustomerPortal,
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
      })
      .catch(() => {
        if (!cancelled && generation === getAgendaSessionGeneration()) {
          setError(appI18n.t("tenantPortal.errors.tenantNotFound"))
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

  if (isAuthenticatedRestoreBlocked()) {
    return null
  }

  if (!signedIn) {
    return (
      <Navigate
        to={subdomain ? tenantPortalPath(subdomain) : "/"}
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
  const userLabel = getCustomerLabel() ?? t("account.userFallback")

  return (
    <div className="min-h-screen bg-background text-foreground" style={themeStyle}>
      <AppShell
        sidebar={({ onNavigate }) => (
          <CustomerSidebar
            brandLabel={branding.displayName}
            logoSvg={branding.logoSvg}
            primaryColor={branding.primaryColor}
            items={navItems}
            onNavigate={onNavigate}
          />
        )}
        pageTitle={pageTitle}
        userLabel={userLabel}
        initials={getEmailInitials(userLabel)}
        profileTo={profileTo}
        enlargeHeaderTargets
        showLanguageCode
        onSignOut={() => {
          const path = signOutCustomerPortal(subdomain)
          void navigate(path, { replace: true })
        }}
      >
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
      </AppShell>
    </div>
  )
}
