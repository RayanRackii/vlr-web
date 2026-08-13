import { Skeleton } from "@/components/ui/skeleton"

type ScheduleDaySlotsSkeletonProps = {
  /** Approximate number of slot rows to mirror the timeline. */
  rows?: number
}

/** Structural skeleton for admin DaySlotsTimeline (vertical slot cards). */
export function ScheduleDaySlotsSkeleton({
  rows = 6,
}: ScheduleDaySlotsSkeletonProps) {
  return (
    <ol
      className="relative space-y-3 border-l border-border pl-6"
      aria-hidden
    >
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="relative">
          <span className="absolute -left-[1.6rem] top-4 size-2.5 rounded-full bg-muted-foreground/20" />
          <div className="rounded-lg border border-border bg-background px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton variant="shimmer" className="h-4 w-36" />
                <Skeleton variant="shimmer" className="h-3 w-48" />
              </div>
              <Skeleton variant="shimmer" className="h-5 w-16 rounded-md" />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
