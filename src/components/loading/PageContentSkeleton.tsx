import { useTranslation } from "react-i18next"

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

type CardGridSkeletonProps = {
  /** Number of placeholder cards. */
  count?: number
  className?: string
}

/** Placeholder grid matching a product-card layout (image + text + action rows). */
export function CardGridSkeleton({
  count = 8,
  className,
}: CardGridSkeletonProps) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
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
