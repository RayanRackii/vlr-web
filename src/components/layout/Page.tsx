import type { ReactNode } from "react"

import { ErrorState } from "@/components/ErrorState"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { PageHeader, type PageHeaderProps } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils"

const WIDTH_CLASS = {
  wide: "w-full max-w-7xl",
  form: "w-full max-w-3xl",
} as const

export type PageProps = {
  header: PageHeaderProps
  /** wide = lists/grids, form = single-column forms. */
  width?: keyof typeof WIDTH_CLASS
  state?: "ready" | "loading" | "error"
  /** Message shown by the error state. */
  error?: ReactNode
  onRetry?: () => void
  className?: string
  children: ReactNode
}

/** Shared page frame: width, header and loading/error body states. */
export function Page({
  header,
  width = "wide",
  state = "ready",
  error,
  onRetry,
  className,
  children,
}: PageProps) {
  return (
    <div className={cn("mx-auto min-w-0 space-y-5", WIDTH_CLASS[width], className)}>
      <PageHeader {...header} className={cn("mb-0 sm:mb-0", header.className)} />
      {state === "loading" ? (
        <PageContentSkeleton />
      ) : state === "error" ? (
        <ErrorState message={typeof error === "string" ? error : ""} onRetry={onRetry ?? (() => {})} />
      ) : (
        children
      )}
    </div>
  )
}
