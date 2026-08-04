import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"
import { getTenantBaseDomain } from "@/lib/tenantDomain"

type TenantPortalChromeHeaderProps = {
  subdomain: string
  /** Path prefix when using /t/:subdomain (empty on host-based portal). */
  portalBasePath: string
}

/**
 * Rolvix chrome shared by all tenant portals: brand + language/theme + auth CTAs.
 * No landing marketing nav (Features / Solutions / Platform / Pricing).
 */
export function TenantPortalChromeHeader({
  subdomain,
  portalBasePath,
}: TenantPortalChromeHeaderProps) {
  const { t } = useTranslation()
  const platformOrigin = `https://${getTenantBaseDomain()}`
  const loginHref = portalBasePath || "/"
  const registerHref = portalBasePath
    ? `${portalBasePath}/register`
    : "/register"

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <a
          href={platformOrigin}
          className="flex items-center gap-1 text-2xl font-extrabold tracking-tighter text-foreground"
          aria-label={t("landing.header.brandAria")}
        >
          <span>Rolvix</span>
          <span className="text-primary" aria-hidden="true">
            .
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

          <div
            className="mx-1 hidden h-5 w-px bg-border/50 sm:block"
            aria-hidden="true"
          />

          <div className="flex items-center gap-2 sm:gap-4">
            <Button type="button" variant="ghost" size="sm" render={<Link to={loginHref} />}>
              {t("landing.header.login")}
            </Button>
            <Button
              type="button"
              size="sm"
              render={<Link to={registerHref} />}
            >
              {t("tenantPortal.header.ctaRegister")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
      <span className="sr-only">{subdomain}</span>
    </header>
  )
}
