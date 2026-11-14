import type { ReactNode } from "react"

import { ErrorState } from "@/components/ErrorState"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { PageHeader, type PageHeaderProps } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils"

const WIDTH_CLASS = {
  wide: "w-full max-w-7xl",
  form: "w-full max-w-3xl",
  full: "w-full",
} as const

type PageBaseProps = {
  header: PageHeaderProps
  /** wide = lists/grids, form = single-column forms, full = the whole content width (calendars). */
  width?: keyof typeof WIDTH_CLASS
  className?: string
  children: ReactNode
}

export type PageProps = PageBaseProps &
  (
    | { state?: "ready" | "loading"; error?: undefined; onRetry?: undefined }
    | {
        state: "error"
        /** Message shown by the error state. */
        error: string
        onRetry: () => void
      }
  )

/** Shared page frame: width, header and loading/error body states. */
export function Page({
  header,
  width = "wide",
  className,
  children,
  ...rest
}: PageProps) {
  return (
    <div className={cn("mx-auto min-w-0 space-y-5", WIDTH_CLASS[width], className)}>
      <PageHeader {...header} className={cn("mb-0 sm:mb-0", header.className)} />
      {rest.state === "loading" ? (
        <PageContentSkeleton />
      ) : rest.state === "error" ? (
        <ErrorState message={rest.error} onRetry={rest.onRetry} />
      ) : (
        children
      )}
    </div>
  )
}
