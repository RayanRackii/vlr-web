import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"

export type PageHeaderProps = {
  /** Primary page title. Rendered as the page's single <h1>. */
  title: ReactNode
  /** Optional supporting copy shown under the title. */
  description?: ReactNode
  /** Optional lucide icon shown in a soft badge beside the title. */
  icon?: LucideIcon
  /** Primary/secondary actions aligned to the end of the header row. */
  actions?: ReactNode
  className?: string
}

/**
 * Standard page header used inside the authenticated shell's content area:
 * a title, optional description, and an actions slot that drops below the
 * title on narrow viewports. Keeps spacing rhythm consistent across screens.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
