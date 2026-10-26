import { useEffect, useMemo, useState } from "react"
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AuthSplitShell } from "@/components/layout/AuthSplitShell"
import { Button } from "@/components/ui/button"
import { useTenantDocumentMeta } from "@/hooks/useTenantDocumentMeta"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"
import { useTenantThemeStyle } from "@/lib/useTenantTheme"
import { inspectTenantLogoSvg } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"
import { TenantPortalChromeHeader } from "@/features/tenantPortal/components/TenantPortalChromeHeader"
import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"
import { isTenantAuthPagePath } from "@/features/tenantPortal/lib/tenantAuthPagePath"
import { sanitizeTenantLogoSvg } from "@/features/tenantPortal/lib/sanitizeTenantLogoSvg"
import { getTenantBaseDomain } from "@/lib/tenantDomain"
import { isAxiosError } from "@/lib/api"
import {
  fetchTenantBranding,
  isCustomerSignedInForTenant,
  resolveTenantSubdomain,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

type PortalLoadError = "missingSubdomain" | "notFound" | "loadFailed"

/** Login and register only. Verify-email and password reset stay reachable. */
function isCustomerAuthEntryPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/register") {
    return true
  }

  return /^\/t\/[a-z0-9-]+(?:\/register)?\/?$/i.test(pathname)
}

export function TenantPortalLayout() {
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

  const portalBasePath = params.subdomain ? `/t/${params.subdomain}` : ""

  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [error, setError] = useState<PortalLoadError | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryNonce, setRetryNonce] = useState(0)
  useTenantDocumentMeta(
    branding && {
      name: branding.displayName,
      logoSvg: branding.logoSvg,
      primaryColor: branding.primaryColor,
    },
  )

  const redirectSignedIn =
    Boolean(subdomain) &&
    isCustomerAuthEntryPath(location.pathname) &&
    isCustomerSignedInForTenant(subdomain ?? "")

  useEffect(() => {
    if (!subdomain) {
      setError("missingSubdomain")
      setLoading(false)
      return
    }

    if (
      isCustomerAuthEntryPath(location.pathname) &&
      isCustomerSignedInForTenant(subdomain)
    ) {
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
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            isAxiosError(requestError) && requestError.response?.status === 404
              ? "notFound"
              : "loadFailed",
          )
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
  }, [location.pathname, subdomain, retryNonce])

  const errorMessage =
    error === "missingSubdomain"
      ? t("tenantPortal.errors.missingSubdomain")
      : error === "notFound"
        ? t("tenantPortal.errors.tenantNotFound")
        : error === "loadFailed"
          ? t("tenantPortal.errors.loadFailed")
          : null

  const logoInspection = useMemo(
    () => inspectTenantLogoSvg(sanitizeTenantLogoSvg(branding?.logoSvg)),
    [branding?.logoSvg],
  )
  const { tokens, style: themeStyle } = useTenantThemeStyle(
    branding?.primaryColor,
    branding?.accentColor,
    {
      logoBackgroundColor: logoInspection.backgroundColor,
      logoBackgroundIsDark:
        logoInspection.hasEmbeddedBackground && logoInspection.backgroundIsDark,
    },
  )

  if (redirectSignedIn && subdomain) {
    return <Navigate to={tenantPortalPath(subdomain, "app")} replace />
  }

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

  if (error === "notFound") {
    return (
      <div className="min-h-screen" style={themeStyle}>
        <TenantPortalChromeHeader
          subdomain={subdomain ?? "unknown"}
          portalBasePath={portalBasePath}
        />
        <main className="flex min-h-screen items-center justify-center p-6 pt-24">
          <PortalNotFoundRoute />
        </main>
      </div>
    )
  }

  if (error === "loadFailed") {
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
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRetryNonce((current) => current + 1)}
            >
              {t("tenantPortal.errors.retry")}
            </Button>
          </div>
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
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
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

  if (isTenantAuthPagePath(location.pathname)) {
    const hasCustomBrand = Boolean(branding.primaryColor)
    const brandPanelStyle = hasCustomBrand
      ? {
          background: `linear-gradient(135deg, color-mix(in srgb, ${tokens.primary} 14%, var(--background)) 0%, color-mix(in srgb, ${tokens.accent} 10%, var(--background)) 100%)`,
        }
      : undefined

    return (
      <div className="min-h-screen overflow-x-clip text-foreground" style={themeStyle}>
        <AuthSplitShell
          brandPanelStyle={brandPanelStyle}
          brandPanel={
            <div className="max-w-md space-y-6">
              <TenantLogoMark
                logoSvg={branding.logoSvg}
                displayName={branding.displayName}
                primaryColor={branding.primaryColor}
                size="lg"
                className="mx-0"
              />
              <div className="space-y-2">
                <h2 className="break-words text-4xl font-semibold tracking-tight text-foreground">
                  {branding.displayName}
                </h2>
                <p className="text-base leading-relaxed text-foreground/85">
                  {branding.welcomeTagline ?? t("tenantPortal.defaultTagline")}
                </p>
              </div>
            </div>
          }
          brandFootnote={
            <p className="text-xs text-foreground/80">
              {t("tenantPortal.authPanel.poweredBy")}
            </p>
          }
          mobileBrand={
            <div className="flex min-w-0 items-center gap-2">
              <TenantLogoMark
                logoSvg={branding.logoSvg}
                displayName={branding.displayName}
                primaryColor={branding.primaryColor}
                size="sm"
              />
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                {branding.displayName}
              </span>
            </div>
          }
          headerActions={
            <>
              <LanguageSwitcher
                className={headerTouchTargetClassName}
                showShortLabel
              />
              <ThemeToggle className={headerTouchTargetClassName} />
            </>
          }
        >
          <TenantTimeZoneProvider timeZoneId={branding.timeZoneId}>
            <Outlet context={{ subdomain, branding, primary: tokens.primary }} />
          </TenantTimeZoneProvider>
        </AuthSplitShell>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-clip text-foreground" style={themeStyle}>
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
            <TenantTimeZoneProvider timeZoneId={branding.timeZoneId}>
              <Outlet context={{ subdomain, branding, primary: tokens.primary }} />
            </TenantTimeZoneProvider>
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
