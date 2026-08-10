import { Check, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type WizardPanelStep = {
  id: string
  label: string
}

type WizardPanelsStepperProps = {
  steps: readonly WizardPanelStep[]
  currentIndex: number
  /** 0-based indices that may be clicked (typically completed steps). */
  onStepClick?: (index: number) => void
  className?: string
}

/**
 * Horizontal panels stepper with chevron separators (no vertical dividers).
 * Uses theme primary for current/complete states.
 */
export function WizardPanelsStepper({
  steps,
  currentIndex,
  onStepClick,
  className,
}: WizardPanelsStepperProps) {
  return (
    <nav
      aria-label="Progress"
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-muted/40",
        className,
      )}
    >
      <ol className="flex items-stretch overflow-x-auto">
        {steps.map((step, index) => {
          const status =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming"
          const clickable = Boolean(onStepClick) && index < currentIndex
          const isLast = index === steps.length - 1

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex min-w-0 flex-1 items-stretch",
                status === "current" && "bg-primary/10",
                status === "complete" && "bg-primary/5",
              )}
            >
              <button
                type="button"
                disabled={!clickable}
                aria-current={status === "current" ? "step" : undefined}
                onClick={() => {
                  if (clickable) {
                    onStepClick?.(index)
                  }
                }}
                className={cn(
                  "flex w-full min-w-[7.5rem] items-center gap-2.5 px-3 py-3 text-left text-sm sm:gap-3 sm:px-4",
                  clickable && "cursor-pointer hover:bg-primary/10",
                  !clickable && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    status === "complete" &&
                      "bg-primary text-primary-foreground",
                    status === "current" &&
                      "bg-primary text-primary-foreground ring-4 ring-primary/15",
                    status === "upcoming" &&
                      "border border-border bg-card text-muted-foreground",
                  )}
                >
                  {status === "complete" ? (
                    <Check className="size-4" aria-hidden strokeWidth={2.5} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span
                  className={cn(
                    "truncate font-medium",
                    status === "upcoming"
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {!isLast ? (
                <span
                  aria-hidden
                  className="flex shrink-0 items-center self-center pr-1 text-muted-foreground/50"
                >
                  <ChevronRight className="size-4" strokeWidth={1.75} />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
