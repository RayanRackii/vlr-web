import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type SkeletonProps = ComponentProps<"div"> & {
  /** `shimmer` = animated gradient; `pulse` = opacity pulse (default). */
  variant?: "pulse" | "shimmer"
}

function Skeleton({
  className,
  variant = "pulse",
  ...props
}: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant}
      className={cn(
        "rounded-md",
        variant === "pulse" &&
          "animate-pulse bg-muted-foreground/15 dark:bg-muted-foreground/25",
        variant === "shimmer" &&
          "relative overflow-hidden bg-muted-foreground/12 dark:bg-muted-foreground/20",
        className,
      )}
      {...props}
    >
      {variant === "shimmer" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-[skeleton-shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10"
        />
      ) : null}
    </div>
  )
}

export { Skeleton }
export type { SkeletonProps }
