import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { LoadingButton } from "@/components/ui/loading-button"
import { EmptyState } from "@/components/ui/empty-state"

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
    <EmptyState
      icon={Icon}
      title={title}
      description={description}
      className={className}
      action={(actionLabel && onAction) || secondaryAction ? <>{actionLabel && onAction ? (
        <LoadingButton
          type="button"
          disabled={actionDisabled}
          loading={actionLoading}
          onClick={onAction}
        >
          {actionLabel}
        </LoadingButton>
      ) : null}{secondaryAction}</> : undefined}
    />
  )
}
