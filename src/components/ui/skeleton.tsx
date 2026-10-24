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
        "rounded-md bg-muted",
        variant === "pulse" && "animate-pulse",
        variant === "shimmer" && "relative overflow-hidden",
        className,
      )}
      {...props}
    >
      {variant === "shimmer" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-skeleton-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent dark:via-foreground/15"
        />
      ) : null}
    </div>
  )
}

export { Skeleton }
export type { SkeletonProps }
