import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui/button"

const NAV_ITEMS = [
  { href: "#features", labelKey: "landing.header.nav.features" },
  { href: "#solutions", labelKey: "landing.header.nav.solutions" },
  { href: "#platform", labelKey: "landing.header.nav.platform" },
  { href: "#pricing", labelKey: "landing.header.nav.pricing" },
] as const

export function LandingHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-1 text-2xl font-extrabold tracking-tighter text-foreground"
          aria-label={t("landing.header.brandAria")}
        >
          <span>Rolvix</span>
          <span className="text-primary" aria-hidden="true">
            .
          </span>
        </Link>

        <nav
          className="hidden items-center gap-6 md:flex"
          aria-label={t("landing.header.navAria")}
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(item.labelKey)}
            </a>
          ))}
        </nav>

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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigate("/login")
              }}
            >
              {t("landing.header.login")}
            </Button>
            <Button type="button" size="sm" render={<a href="#pricing" />}>
              {t("landing.header.cta")}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
