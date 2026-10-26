import type { CSSProperties, ReactNode } from "react"

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { cn } from "@/lib/utils"

type AuthSplitShellProps = {
  /** Contents of the left lg+ brand panel. */
  brandPanel: ReactNode
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
}

export function AuthSplitShell({
  brandPanel,
  brandPanelStyle,
  brandPanelClassName,
  mobileBrand,
  headerActions,
  title,
  subtitle,
  children,
  widthClassName = "max-w-md",
}: AuthSplitShellProps) {
  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      <div
        className={cn(
          "relative hidden flex-col justify-between overflow-hidden p-10 lg:flex",
          brandPanelClassName ?? "[background:var(--brand-gradient)]",
        )}
        style={brandPanelStyle}
      >
        {brandPanel}
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 p-4 sm:p-6">
          <div className="min-w-0 lg:hidden">{mobileBrand}</div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {headerActions ?? (
              <>
                <LanguageSwitcher showShortLabel />
                <ThemeToggle />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 pt-0 sm:p-8 sm:pt-0">
          <div
            className={cn(
              "w-full animate-in fade-in slide-in-from-bottom-2 duration-500",
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
