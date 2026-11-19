import { useState, type CSSProperties, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import {
  heroAccentColor,
  heroSolidBackground,
  resolveHeroCopy,
} from "@/features/tenantPortal/lib/portalAuthHero"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { cn } from "@/lib/utils"

type PortalAuthHeroProps = {
  branding: TenantBranding
  /** The page's own content renders the `<h1>`, so the hero headline must not. */
  headlineAsParagraph?: boolean
  /** Always use the desktop (lg+) layout, whatever the viewport: for scaled previews only. */
  forceDesktop?: boolean
  className?: string
}

/** Left hero: company photo (or solid brand colour), logo + name, and the landing texts. */
export function PortalAuthHero({ branding, headlineAsParagraph, forceDesktop, className }: PortalAuthHeroProps) {
  const { t } = useTranslation()
  const imageUrl = branding.landingImageUrl?.trim()
  // Remember which URL failed, so a later (valid) URL is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl
  const copy = resolveHeroCopy(branding, t("tenantPortal.login.welcomeDefault"))
  const style: CSSProperties = {
    backgroundColor: heroSolidBackground(branding.primaryColor),
  }
  const Headline = headlineAsParagraph ? "p" : "h1"

  return (
    <section
      className={cn("tenant-hero", forceDesktop && "tenant-hero--desktop", className)}
      style={style}
      data-hero-image={showImage ? "true" : "false"}
    >
      {showImage ? (
        <img
          key={imageUrl}
          src={imageUrl}
          alt=""
          className="tenant-hero-image absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedUrl(imageUrl ?? null)}
        />
      ) : null}
      <div className="tenant-hero-shade" aria-hidden="true" />

      <div className="tenant-hero-inner">
        <div className={cn("tenant-hero-brand", !forceDesktop && "max-lg:pr-28")} data-testid="portal-hero-brand">
          <TenantLogoMark
            logoSvg={branding.logoSvg}
            displayName={branding.displayName}
            primaryColor={branding.primaryColor}
            size="sm"
            className="tenant-hero-logo"
          />
          <div className="min-w-0">
            <p className="tenant-hero-name">{branding.displayName}</p>
            <p className="tenant-hero-sub">
              {t("tenantPortal.redesign.customerPortal")}
            </p>
          </div>
        </div>

        <div className="tenant-hero-copy">
          {copy.kicker ? (
            <p
              className="tenant-hero-kicker"
              style={{ color: heroAccentColor(branding.primaryColor) }}
            >
              {copy.kicker}
            </p>
          ) : null}
          <Headline className="tenant-hero-headline">
            {copy.headline}
          </Headline>
          <p className="tenant-hero-subtitle">{copy.subtitle}</p>
        </div>

        <p className="tenant-brand-footer">
          {t("tenantPortal.authPanel.poweredBy")}
        </p>
      </div>
    </section>
  )
}

type PortalAuthLayoutProps = {
  branding: TenantBranding
  headlineAsParagraph?: boolean
  children: ReactNode
}

/**
 * Shared shell for the customer portal auth screens (login, sign-up, password
 * reset, verification): hero on the left (banner below `lg`), form column on the right.
 */
export function PortalAuthLayout({ branding, headlineAsParagraph, children }: PortalAuthLayoutProps) {
  const { t } = useTranslation()

  return (
    <main className="tenant-auth relative grid min-h-screen w-full lg:h-screen lg:grid-cols-2 lg:overflow-hidden">
      <PortalAuthHero branding={branding} headlineAsParagraph={headlineAsParagraph} />

      <div className="auth-side flex min-w-0 flex-col lg:h-screen lg:overflow-y-auto">
        <div className="auth-tools flex items-center gap-1">
          <LanguageSwitcher className={headerTouchTargetClassName} showShortLabel />
          <ThemeToggle className={headerTouchTargetClassName} />
        </div>

        <div className="auth-center flex flex-1 justify-center">
          <div className="auth-card tenant-auth-form w-full">
            <div className="tenant-company-card" data-testid="portal-company-card">
              <TenantLogoMark
                logoSvg={branding.logoSvg}
                displayName={branding.displayName}
                primaryColor={branding.primaryColor}
                size="sm"
                className="tenant-card-logo"
              />
              <div className="min-w-0">
                <span className="tenant-company-name">{branding.displayName}</span>
                <span className="tenant-company-sub">
                  {t("tenantPortal.redesign.customerPortal")}
                </span>
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </main>
  )
}
