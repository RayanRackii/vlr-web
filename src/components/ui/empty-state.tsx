import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  /** Optional lucide icon shown in a soft circular badge. */
  icon?: LucideIcon
  title: string
  description?: string
  /** Primary action(s): render a `<Button>` (or any node) here. */
  action?: ReactNode
  /** Compact padding for inline / in-card empty states. */
  size?: "sm" | "default"
  className?: string
}

/**
 * Generic empty / zero-state. Icon + title + description + optional action,
 * inside a dashed surface. Prop-driven so callers own i18n strings.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center",
        size === "default" ? "px-6 py-14" : "px-4 py-8",
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon
            className="size-6"
            strokeWidth={ICON_STROKE_WIDTH}
            aria-hidden
          />
        </div>
      ) : null}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
