import { Skeleton } from "@/components/ui/skeleton"

type ScheduleDaySlotsSkeletonProps = {
  rows?: number
  columns?: number
}

export function ScheduleDaySlotsSkeleton({
  rows = 8,
  columns = 4,
}: ScheduleDaySlotsSkeletonProps) {
  return (
    <div
      className="min-h-[420px] overflow-hidden rounded-xl border border-border bg-background"
      aria-hidden
    >
      <div
        className="grid h-12 border-b border-border"
        style={{ gridTemplateColumns: `76px repeat(${columns}, minmax(180px, 1fr))` }}
      >
        <div className="border-r border-border" />
        {Array.from({ length: columns }, (_, index) => (
          <div key={index} className="flex items-center border-r border-border px-3">
            <Skeleton variant="shimmer" className="h-4 w-28" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid h-14 border-b border-border/70"
          style={{ gridTemplateColumns: `76px repeat(${columns}, minmax(180px, 1fr))` }}
        >
          <div className="flex justify-end border-r border-border px-2 pt-2">
            <Skeleton variant="shimmer" className="h-3 w-10" />
          </div>
          {Array.from({ length: columns }, (_, column) => (
            <div key={column} className="border-r border-border/70 p-1">
              {(row + column) % 3 === 0 ? (
                <Skeleton variant="shimmer" className="h-full w-full rounded-md" />
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
