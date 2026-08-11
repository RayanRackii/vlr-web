import { useEffect, useMemo, useState } from "react"
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AppShell } from "@/components/layout/AppShell"
import { getEmailInitials } from "@/components/layout/navigation"
import {
  CustomerSidebar,
  iconForModule,
} from "@/features/tenantPortal/components/CustomerSidebar"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  clearCustomerSession,
  fetchTenantBranding,
  fetchTenantMenu,
  getCustomerAccessToken,
  getCustomerLabel,
  menuItemAgendaPath,
  resolveTenantSubdomain,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export type CustomerAppOutletContext = {
  subdomain: string
  branding: TenantBranding
  primary: string
  menu: ModuleMenuItem[]
}

function modulePath(
  subdomain: string,
  item: ModuleMenuItem,
): string | null {
  if (item.moduleName.toLowerCase() === "rentals") {
    return menuItemAgendaPath(subdomain, item.id)
  }
  return null
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
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
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

  const navItems = menu
    .map((item) => {
      const to = modulePath(subdomain, item)
      if (!to) {
        return null
      }
      return {
        id: item.id,
        label: item.label,
        to,
        icon: iconForModule(item.moduleName),
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const activeItem = navItems.find(
    (item) =>
      location.pathname === item.to ||
      location.pathname.startsWith(`${item.to}/`),
  )
  const pageTitle = activeItem?.label ?? branding.displayName
  const userLabel = getCustomerLabel() ?? t("account.userFallback")
  const primary = branding.primaryColor ?? "#1E293B"

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
