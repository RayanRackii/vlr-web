import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { LoadingButton } from "@/components/ui/loading-button"
import { cn } from "@/lib/utils"

type ScheduleEmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
  actionLoading?: boolean
  secondaryAction?: ReactNode
  className?: string
}

export function ScheduleEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  secondaryAction,
  className,
}: ScheduleEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <LoadingButton
          type="button"
          disabled={actionDisabled}
          loading={actionLoading}
          onClick={onAction}
          className="mt-1"
        >
          {actionLabel}
        </LoadingButton>
      ) : null}
      {secondaryAction}
    </div>
  )
}
