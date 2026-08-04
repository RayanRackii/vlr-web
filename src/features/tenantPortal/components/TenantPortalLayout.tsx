import { useEffect, useMemo, useState } from "react"
import { Outlet, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import {
  fetchTenantBranding,
  getTenantBaseDomain,
  resolveTenantSubdomain,
} from "@/features/tenantPortal/services/tenantPortalService"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function TenantPortalLayout() {
  const { t } = useTranslation()
  const params = useParams()
  const subdomain = useMemo(() => {
    const fromPath = params.subdomain?.toLowerCase()
    if (fromPath) {
      return fromPath
    }
    return resolveTenantSubdomain(window.location.pathname)
  }, [params.subdomain])

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

  const primary = branding?.primaryColor ?? "#0F766E"
  const accent = branding?.accentColor ?? primary

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </main>
    )
  }

  if (error || !branding || !subdomain) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold">{t("tenantPortal.errors.title")}</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href={`https://${getTenantBaseDomain()}/`}
            className="text-sm text-primary underline"
          >
            Rolvix
          </a>
        </div>
      </main>
    )
  }

  return (
    <main
      className="relative flex min-h-screen w-full items-center justify-center p-6"
      style={{
        background: `radial-gradient(ellipse 80% 55% at 50% 0%, ${primary}22, transparent)`,
      }}
    >
      <div className="w-full max-w-md space-y-6">
        <header className="space-y-4 text-center">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.displayName}
              className="mx-auto h-16 w-16 rounded-xl object-cover"
            />
          ) : (
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: primary }}
              aria-hidden="true"
            >
              {initials(branding.displayName)}
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {branding.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {branding.welcomeTagline ?? t("tenantPortal.defaultTagline")}
            </p>
          </div>
        </header>

        <div
          className="rounded-xl border border-border/80 bg-card p-6 shadow-sm"
          style={{ borderTopColor: accent, borderTopWidth: 3 }}
        >
          <Outlet context={{ subdomain, branding, primary }} />
        </div>
      </div>
    </main>
  )
}

export type TenantPortalOutletContext = {
  subdomain: string
  branding: TenantBranding
  primary: string
}
