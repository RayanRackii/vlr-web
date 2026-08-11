import { useEffect, useMemo, useState } from "react"
import { Outlet, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

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

  const primary = branding?.primaryColor ?? "#1E293B"
  const accent = branding?.accentColor ?? primary

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/40">
        {subdomain ? (
          <TenantPortalChromeHeader
            subdomain={subdomain}
            portalBasePath={portalBasePath}
          />
        ) : null}
        <main className="flex min-h-screen items-center justify-center p-6 pt-24">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </main>
      </div>
    )
  }

  if (error || !branding || !subdomain) {
    return (
      <div className="min-h-screen bg-muted/40">
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
    <div className="min-h-screen">
      <TenantPortalChromeHeader
        subdomain={subdomain}
        portalBasePath={portalBasePath}
      />
      <main
        className="relative flex min-h-screen w-full items-center justify-center p-6 pt-24"
        style={{
          background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${primary}22, transparent)`,
        }}
      >
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-4 text-center">
            <TenantLogoMark
              logoSvg={branding.logoSvg}
              displayName={branding.displayName}
              primaryColor={branding.primaryColor}
              size="lg"
            />
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {branding.displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {branding.welcomeTagline ?? t("tenantPortal.defaultTagline")}
              </p>
            </div>
          </div>

          <div
            className="rounded-xl border border-border/80 bg-card p-6 shadow-sm"
            style={{ borderTopColor: accent, borderTopWidth: 3 }}
          >
            <Outlet context={{ subdomain, branding, primary }} />
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
