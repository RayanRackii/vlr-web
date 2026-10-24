import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { cn } from "@/lib/utils"

function AuthWordmark() {
  const { t } = useTranslation()

  return (
    <Link
      to="/"
      className="inline-flex items-center gap-0.5 text-2xl font-extrabold tracking-tighter text-foreground"
      aria-label={t("landing.header.brandAria")}
    >
      Rolvix
      <span className="text-primary" aria-hidden="true">
        .
      </span>
    </Link>
  )
}

type AuthLayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
  /** Override the default form column width (e.g. a wizard needs more room). */
  widthClassName?: string
}

export function AuthLayout({
  title,
  subtitle,
  children,
  widthClassName = "max-w-md",
}: AuthLayoutProps) {
  const { t } = useTranslation()

  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex [background:var(--brand-gradient)]">
        <AuthWordmark />

        <div className="max-w-md animate-in fade-in slide-in-from-left-4 duration-700 space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            {t("auth.brandPanel.title")}
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            {t("auth.brandPanel.body")}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("auth.brandPanel.footnote")}
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 p-4 sm:p-6">
          <div className="lg:hidden">
            <AuthWordmark />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher showShortLabel />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 pt-0 sm:p-8 sm:pt-0">
          <div
            className={cn(
              "w-full animate-in fade-in slide-in-from-bottom-2 duration-500",
              widthClassName,
            )}
          >
            <header className="mb-8 space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </header>

            {children}
          </div>
        </div>
      </div>
    </main>
  )
}
