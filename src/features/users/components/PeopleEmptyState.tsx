import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type PeopleEmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function PeopleEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: PeopleEmptyStateProps) {
  return (
    <div
      className={cn(
        "people-empty flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="people-empty-icon">
        <Icon className="size-9" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  )
}
