import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type SkeletonProps = ComponentProps<"div"> & {
  /** `shimmer` = animated gradient (product default); `pulse` = opacity pulse. */
  variant?: "pulse" | "shimmer"
}

function Skeleton({
  className,
  variant = "shimmer",
  ...props
}: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant}
      className={cn(
        "rounded-md",
        variant === "pulse" && "animate-pulse bg-zinc-200 dark:bg-zinc-700",
        variant === "shimmer" &&
          "relative overflow-hidden bg-zinc-200 dark:bg-zinc-700",
        className,
      )}
      {...props}
    >
      {variant === "shimmer" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-skeleton-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/25"
        />
      ) : null}
    </div>
  )
}

export { Skeleton }
export type { SkeletonProps }
