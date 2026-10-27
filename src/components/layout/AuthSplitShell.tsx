import type { CSSProperties, ReactNode } from "react"

import { headerTouchTargetClassName } from "@/components/layout/headerTouchTarget"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { cn } from "@/lib/utils"

type AuthSplitShellProps = {
  /** Vertically-centered contents of the left lg+ brand panel (logo, name, tagline). */
  brandPanel: ReactNode
  /** Anchored to the bottom of the brand panel, e.g. the "Tecnologia Rolvix" note. */
  brandFootnote?: ReactNode
  brandPanelStyle?: CSSProperties
  /** Defaults to the Rolvix brand gradient. */
  brandPanelClassName?: string
  /** Shown top-left on < lg, where the brand panel is hidden. */
  mobileBrand: ReactNode
  /** Defaults to the language switcher + theme toggle. */
  headerActions?: ReactNode
  title?: string
  subtitle?: string
  children: ReactNode
  /** Override the default form column width (e.g. a wizard needs more room). */
  widthClassName?: string
  /** Tenant auth keeps the brand panel on mobile, above an overlapping form card. */
  variant?: "default" | "tenant"
}

export function AuthSplitShell({
  brandPanel,
  brandFootnote,
  brandPanelStyle,
  brandPanelClassName,
  mobileBrand,
  headerActions,
  title,
  subtitle,
  children,
  widthClassName = "max-w-md",
  variant = "default",
}: AuthSplitShellProps) {
  return (
    <main className={cn("grid min-h-screen w-full lg:h-screen lg:grid-cols-2 lg:overflow-hidden", variant === "tenant" && "tenant-auth")}>
      <div
        className={cn(
          "auth-brand relative hidden flex-col overflow-y-auto p-10 lg:flex",
          brandPanelClassName ?? "[background:var(--brand-gradient)]",
        )}
        style={brandPanelStyle}
      >
        <div className="auth-brand-content flex flex-1 flex-col items-center justify-center text-center">
          {brandPanel}
        </div>
        {brandFootnote}
      </div>

      <div className="auth-side flex flex-col lg:h-screen lg:overflow-y-auto">
        <div className="auth-tools flex items-center justify-between gap-2 p-4 sm:p-6">
          {variant === "default" ? <div className="min-w-0 lg:hidden">{mobileBrand}</div> : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {headerActions ?? (
              <>
                <LanguageSwitcher
                  className={headerTouchTargetClassName}
                  showShortLabel
                />
                <ThemeToggle className={headerTouchTargetClassName} />
              </>
            )}
          </div>
        </div>

        <div className="auth-center flex flex-1 items-center justify-center p-6 pt-0 sm:p-8 sm:pt-0">
          <div
            className={cn(
              "auth-card w-full animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none",
              widthClassName,
            )}
          >
            {title ? (
              <header className="mb-8 space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </header>
            ) : null}

            {children}
          </div>
        </div>
      </div>
    </main>
  )
}
