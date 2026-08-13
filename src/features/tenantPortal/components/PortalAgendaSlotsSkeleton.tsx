import { Skeleton } from "@/components/ui/skeleton"

type PortalAgendaSlotsSkeletonProps = {
  count?: number
}

/** Structural skeleton for B2C bookable slot chip grid. */
export function PortalAgendaSlotsSkeleton({
  count = 6,
}: PortalAgendaSlotsSkeletonProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="space-y-2 rounded-md border border-border px-3 py-2"
        >
          <Skeleton variant="shimmer" className="h-4 w-24" />
          <Skeleton variant="shimmer" className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
