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
    </div>
  )
}
