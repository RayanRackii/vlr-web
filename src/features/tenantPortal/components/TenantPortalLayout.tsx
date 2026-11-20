import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useTenantDocumentMeta } from "@/hooks/useTenantDocumentMeta"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"
import { useTenantThemeStyle } from "@/lib/useTenantTheme"
import { inspectTenantLogoSvg } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"
import { TenantPortalChromeHeader } from "@/features/tenantPortal/components/TenantPortalChromeHeader"
import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import { PortalAuthLayout } from "@/features/tenantPortal/components/PortalAuthLayout"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"
import { isTenantAuthPagePath } from "@/features/tenantPortal/lib/tenantAuthPagePath"
import { readReturnToParam } from "@/features/tenantPortal/lib/tenantPortalReturnTo"
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
import "./tenantPortalAuth.css"

type PortalLoadError = "missingSubdomain" | "notFound" | "loadFailed"

/**
 * Auth-shell routes whose own content (a `PortalRecoveryState`) renders the
 * page `<h1>`. On these the hero headline must stay a `<p>` so the page keeps a
 * single `<h1>`; the form routes keep the hero headline as their `<h1>`.
 */
function isTenantAuthRecoveryPath(pathname: string): boolean {
  return /^\/(?:t\/[a-z0-9-]+)?\/?reset-password\/?$/i.test(pathname)
}

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
      slug: branding.subdomain || subdomain,
      name: branding.displayName,
      logoSvg: branding.logoSvg,
      primaryColor: branding.primaryColor,
    },
  )

  const redirectSignedIn =
    Boolean(subdomain) &&
    isCustomerAuthEntryPath(location.pathname) &&
    isCustomerSignedInForTenant(subdomain ?? "")

  // Branding belongs to the tenant, not to the page: load it once per subdomain (or retry) and keep
  // the shell mounted while customers move between login, register and recovery pages.
  const brandingLoadedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!subdomain) {
      setError("missingSubdomain")
      setLoading(false)
      return
    }

    if (redirectSignedIn) {
      setLoading(false)
      return
    }

    const loadKey = `${subdomain}:${retryNonce}`
    if (brandingLoadedFor.current === loadKey) {
      return
    }

    let cancelled = false
    setLoading(true)
    void fetchTenantBranding(subdomain)
      .then((data) => {
        if (!cancelled) {
          brandingLoadedFor.current = loadKey
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
  }, [subdomain, retryNonce, redirectSignedIn])

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
    branding?.secondaryColor ?? branding?.accentColor,
    {
      auth: isTenantAuthPagePath(location.pathname),
      logoBackgroundColor: logoInspection.backgroundColor,
      logoBackgroundIsDark:
        logoInspection.hasEmbeddedBackground && logoInspection.backgroundIsDark,
    },
  )

  if (redirectSignedIn && subdomain) {
    const returnTo = readReturnToParam(new URLSearchParams(location.search))
    return <Navigate to={returnTo ?? tenantPortalPath(subdomain, "app")} replace />
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
          <PortalNotFoundRoute tenantExists={false} />
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
    return (
      <div className="min-h-screen overflow-x-clip text-foreground" style={themeStyle}>
        <PortalAuthLayout
          branding={branding}
          headlineAsParagraph={isTenantAuthRecoveryPath(location.pathname)}
        >
          <TenantTimeZoneProvider timeZoneId={branding.timeZoneId}>
            <Suspense fallback={<PageContentSkeleton rows={3} />}>
              <Outlet context={{ subdomain, branding, primary: tokens.primary }} />
            </Suspense>
          </TenantTimeZoneProvider>
        </PortalAuthLayout>
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
        <div className="w-full max-w-3xl space-y-6">
          <div className="space-y-4 text-center">
            <TenantLogoMark
              logoSvg={branding.logoSvg}
              displayName={branding.displayName}
              primaryColor={branding.primaryColor}
              size="lg"
            />
            <div className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {branding.displayName}
              </p>
              <p className="text-sm text-muted-foreground">
                {branding.welcomeTagline ?? t("tenantPortal.defaultTagline")}
              </p>
            </div>
          </div>

          <TenantTimeZoneProvider timeZoneId={branding.timeZoneId}>
            <Suspense fallback={<PageContentSkeleton rows={3} />}>
              <Outlet context={{ subdomain, branding, primary: tokens.primary }} />
            </Suspense>
          </TenantTimeZoneProvider>
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
