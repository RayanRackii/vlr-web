import { useEffect, useMemo, useState } from "react"
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { AppShell } from "@/components/layout/AppShell"
import { getEmailInitials } from "@/components/layout/navigation"
import { ROLVIX_PRIMARY_COLOR } from "@/lib/brandColors"
import { CustomerSidebar } from "@/features/tenantPortal/components/CustomerSidebar"
import type {
  ModuleMenuItem,
  TenantBranding,
} from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  clearCustomerSession,
  fetchTenantBranding,
  fetchTenantMenu,
  getCustomerAccessToken,
  getCustomerLabel,
  resolveTenantSubdomain,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import { buildCustomerNavItems } from "@/features/catalog/customerNav"

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
  const subdomain = useMemo(() => {
    const fromPath = params.subdomain?.toLowerCase()
    if (fromPath) {
      return fromPath
    }
    return resolveTenantSubdomain(window.location.pathname)
  }, [params.subdomain])

  const signedIn = getCustomerAccessToken() !== null
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [menu, setMenu] = useState<ModuleMenuItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!subdomain || !signedIn) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetchTenantBranding(subdomain),
      fetchTenantMenu(subdomain),
    ])
      .then(([brandingData, menuData]) => {
        if (cancelled) {
          return
        }
        setBranding(brandingData)
        setMenu(menuData)
        setError(null)
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("tenantPortal.errors.tenantNotFound"))
          setBranding(null)
          setMenu([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [subdomain, signedIn, t])

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

  const navItems = buildCustomerNavItems(subdomain, menu, t)

  const activeItem = navItems.find(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  )
  const profileTo = tenantPortalPath(subdomain, "app/perfil")
  const isProfilePage = location.pathname === profileTo
  const pageTitle = isProfilePage
    ? t("tenantPortal.profile.title")
    : (activeItem?.label ?? branding.displayName)
  const userLabel = getCustomerLabel() ?? t("account.userFallback")
  const primary = branding.primaryColor ?? ROLVIX_PRIMARY_COLOR

  return (
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
      onSignOut={() => {
        clearCustomerSession()
        window.location.assign(tenantPortalPath(subdomain))
      }}
    >
      <Outlet
        context={
          {
            subdomain,
            branding,
            primary,
            menu,
          } satisfies CustomerAppOutletContext
        }
      />
    </AppShell>
  )
}
