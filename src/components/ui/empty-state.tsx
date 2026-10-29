import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  /** Optional lucide icon shown in a soft circular badge. */
  icon?: LucideIcon
  title: string
  description?: string
  example?: string
  learnMore?: { to: string; label: string }
  illustration?: ReactNode
  variant?: "default" | "portal"
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
  example,
  learnMore,
  illustration,
  variant = "default",
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      role={variant === "portal" ? "status" : undefined}
      className={cn(
        "empty-state-enter motion-reduce:animate-none",
        variant === "portal"
          ? "portal-empty"
          : "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border text-center",
        variant === "default" && (size === "default" ? "px-6 py-14" : "px-4 py-8"),
        className,
      )}
    >
      {illustration ?? (Icon ? (
        <div data-slot="empty-state-icon" className={variant === "portal" ? "portal-empty-icon" : "flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"}>
          <Icon
            className="size-6"
            strokeWidth={ICON_STROKE_WIDTH}
            aria-hidden
          />
        </div>
      ) : null)}
      <div className="max-w-sm space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {example ? <p className="text-sm text-muted-foreground">{example}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
      {learnMore ? (
        <Button variant="link" render={<Link to={learnMore.to} />}>
          {learnMore.label}
        </Button>
      ) : null}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
