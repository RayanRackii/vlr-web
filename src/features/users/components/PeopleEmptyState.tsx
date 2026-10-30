import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

export function PeopleEmptyState({ className, ...props }: EmptyStateProps) {
  return (
    <EmptyState
      {...props}
      className={cn(
        "people-empty border-0 [&_h2]:text-lg [&_[data-slot=empty-state-icon]_svg]:size-9",
        className,
      )}
    />
  )
}
