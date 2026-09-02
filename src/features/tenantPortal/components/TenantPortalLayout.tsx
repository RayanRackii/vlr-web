import { useEffect, useMemo, useState } from "react"
import { Outlet, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { useTenantThemeStyle } from "@/lib/useTenantTheme"
import { TenantPortalChromeHeader } from "@/features/tenantPortal/components/TenantPortalChromeHeader"
import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import { getTenantBaseDomain } from "@/lib/tenantDomain"
import {
  fetchTenantBranding,
  resolveTenantSubdomain,
} from "@/features/tenantPortal/services/tenantPortalService"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

export function TenantPortalLayout() {
  const { t, i18n } = useTranslation()
  const params = useParams()
  const subdomain = useMemo(() => {
    const fromPath = params.subdomain?.toLowerCase()
    if (fromPath) {
      return fromPath
    }
    return resolveTenantSubdomain(window.location.pathname)
  }, [params.subdomain])

  const portalBasePath = params.subdomain ? `/t/${params.subdomain}` : ""

  useEffect(() => {
    // Tenant portals always open in pt-BR by default (user can still switch).
    if (!i18n.language.startsWith("pt")) {
      void i18n.changeLanguage("pt-BR")
    }
  }, [i18n])

  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!subdomain) {
      setError(t("tenantPortal.errors.missingSubdomain"))
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchTenantBranding(subdomain)
      .then((data) => {
        if (!cancelled) {
          setBranding(data)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("tenantPortal.errors.tenantNotFound"))
          setBranding(null)
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
  }, [subdomain, t])

  const { tokens, style: themeStyle } = useTenantThemeStyle(
    branding?.primaryColor,
    branding?.accentColor,
  )

  if (loading) {
    return (
      <div className="min-h-screen" style={themeStyle}>
        {subdomain ? (
          <TenantPortalChromeHeader
            subdomain={subdomain}
            portalBasePath={portalBasePath}
          />
        ) : null}
        <main className="flex min-h-screen items-center justify-center p-6 pt-24">
          <PageContentSkeleton rows={2} className="w-full max-w-md" />
        </main>
      </div>
    )
  }

  if (error || !branding || !subdomain) {
    return (
      <div className="min-h-screen" style={themeStyle}>
        <TenantPortalChromeHeader
          subdomain={subdomain ?? "unknown"}
          portalBasePath={portalBasePath}
        />
        <main className="flex min-h-screen items-center justify-center p-6 pt-24">
          <div className="max-w-md space-y-3 text-center">
            <h1 className="text-xl font-semibold">
              {t("tenantPortal.errors.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <a
              href={`https://${getTenantBaseDomain()}/`}
              className="text-sm text-primary underline"
            >
              Rolvix
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-foreground" style={themeStyle}>
      <TenantPortalChromeHeader
        subdomain={subdomain}
        portalBasePath={portalBasePath}
      />
      <main className="relative flex min-h-screen w-full items-center justify-center p-6 pt-24">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-4 text-center">
            <TenantLogoMark
              logoSvg={branding.logoSvg}
              displayName={branding.displayName}
              primaryColor={branding.primaryColor}
              size="lg"
            />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {branding.displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {branding.welcomeTagline ?? t("tenantPortal.defaultTagline")}
              </p>
            </div>
          </div>

          <div
            className="rounded-xl border p-6 shadow-sm"
            style={{
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
              borderTopColor: tokens.accent,
              borderTopWidth: 3,
              color: tokens.text,
            }}
          >
            <Outlet context={{ subdomain, branding, primary: tokens.primary }} />
          </div>
        </div>
      </main>
    </div>
  )
}

export type TenantPortalOutletContext = {
  subdomain: string
  branding: TenantBranding
  primary: string
}
