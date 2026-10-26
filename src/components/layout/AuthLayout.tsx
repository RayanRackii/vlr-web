import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { AuthSplitShell } from "@/components/layout/AuthSplitShell"

function AuthWordmark() {
  const { t } = useTranslation()

  return (
    <Link
      to="/"
      className="inline-flex items-center gap-0.5 text-3xl font-extrabold tracking-tighter text-foreground"
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
  widthClassName,
}: AuthLayoutProps) {
  const { t } = useTranslation()

  return (
    <AuthSplitShell
      brandPanel={
        <div className="max-w-md animate-in fade-in slide-in-from-left-4 duration-700 space-y-6">
          <AuthWordmark />

          <div className="space-y-4">
            <h2 className="text-4xl font-semibold tracking-tight text-foreground">
              {t("auth.brandPanel.title")}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {t("auth.brandPanel.body")}
            </p>
          </div>
        </div>
      }
      brandFootnote={
        <p className="text-xs text-muted-foreground">
          {t("auth.brandPanel.footnote")}
        </p>
      }
      mobileBrand={<AuthWordmark />}
      title={title}
      subtitle={subtitle}
      widthClassName={widthClassName}
    >
      {children}
    </AuthSplitShell>
  )
}
