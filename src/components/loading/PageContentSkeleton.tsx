import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type PageContentSkeletonProps = {
  /** Number of list/card rows under the title block. */
  rows?: number
  className?: string
}

/** Generic first-load placeholder for list/settings pages. */
export function PageContentSkeleton({
  rows = 4,
  className,
}: PageContentSkeletonProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      role="status"
      aria-busy="true"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-8 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

type TableRowsSkeletonProps = {
  columns: number
  rows?: number
}

/** Structural skeleton rows for data tables (shadcn TableBody). */
export function TableRowsSkeleton({
  columns,
  rows = 5,
}: TableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton
                className={cn(
                  "h-4",
                  colIndex === 0
                    ? "w-28"
                    : colIndex === columns - 1
                      ? "ml-auto w-8"
                      : "w-24",
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

type FormSkeletonProps = {
  fields?: number
  className?: string
}

export function FormSkeleton({ fields = 4, className }: FormSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-busy="true">
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-28" />
    </div>
  )
}
