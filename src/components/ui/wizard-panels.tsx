import { Check, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type WizardPanelStep = {
  id: string
  label: string
}

export type WizardPanelsStepperVariant = "horizontal" | "vertical" | "compact"

type WizardPanelsStepperProps = {
  steps: readonly WizardPanelStep[]
  currentIndex: number
  onStepClick?: (index: number) => void
  className?: string
  variant?: WizardPanelsStepperVariant
  ariaLabel?: string
  testId?: string
}

function stepStatus(index: number, currentIndex: number) {
  if (index < currentIndex) {
    return "complete" as const
  }

  if (index === currentIndex) {
    return "current" as const
  }

  return "upcoming" as const
}

function StepIndexBadge({
  index,
  status,
}: {
  index: number
  status: "complete" | "current" | "upcoming"
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
        status === "complete" && "bg-primary text-primary-foreground",
        status === "current" && "bg-primary text-primary-foreground",
        status === "upcoming" &&
          "border border-border bg-card text-muted-foreground",
      )}
    >
      {status === "complete" ? (
        <Check className="size-3.5" aria-hidden strokeWidth={2.5} />
      ) : (
        String(index + 1).padStart(2, "0")
      )}
    </span>
  )
}

/** Horizontal step list — no vertical dividers or absolute SVG chevrons. */
export function WizardPanelsStepper({
  steps,
  currentIndex,
  onStepClick,
  className,
  variant = "horizontal",
  ariaLabel = "Progress",
  testId,
}: WizardPanelsStepperProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-testid={testId}
      data-variant={variant}
      className={cn(
        variant === "horizontal" && "rounded-lg border border-border bg-muted/30 p-1",
        variant === "vertical" && "w-full",
        variant === "compact" && "w-full",
        className,
      )}
    >
      {variant === "vertical" ? (
        <ol className="flex flex-col gap-1">
          {steps.map((step, index) => {
            const status = stepStatus(index, currentIndex)
            const clickable = Boolean(onStepClick) && index < currentIndex

            return (
              <li key={step.id}>
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
                    "flex w-full items-start gap-3 rounded-md px-2 py-2.5 text-left text-sm",
                    status === "current" && "bg-primary/10",
                    status === "complete" && "bg-primary/5",
                    clickable && "cursor-pointer hover:bg-primary/10",
                    !clickable && "cursor-default",
                  )}
                >
                  <StepIndexBadge index={index} status={status} />
                  <span
                    className={cn(
                      "pt-0.5 font-medium leading-snug",
                      status === "upcoming"
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : variant === "compact" ? (
        <ol className="flex flex-wrap items-start gap-2">
          {steps.map((step, index) => {
            const status = stepStatus(index, currentIndex)
            const clickable = Boolean(onStepClick) && index < currentIndex

            return (
              <li key={step.id} className="min-w-0 max-w-full">
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
                    "flex max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs sm:text-sm",
                    status === "current" && "bg-primary/10",
                    status === "complete" && "bg-primary/5",
                    clickable && "cursor-pointer hover:bg-primary/10",
                    !clickable && "cursor-default",
                  )}
                >
                  <StepIndexBadge index={index} status={status} />
                  <span
                    className={cn(
                      "whitespace-normal font-medium leading-snug",
                      status === "upcoming"
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : (
        <ol className="flex flex-wrap items-center gap-1">
          {steps.map((step, index) => {
            const status = stepStatus(index, currentIndex)
            const clickable = Boolean(onStepClick) && index < currentIndex
            const isLast = index === steps.length - 1

            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
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
                    "flex w-full min-w-[6.5rem] items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-sm",
                    status === "current" && "bg-primary/10",
                    status === "complete" && "bg-primary/5",
                    clickable && "cursor-pointer hover:bg-primary/10",
                    !clickable && "cursor-default",
                  )}
                >
                  <StepIndexBadge index={index} status={status} />
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
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground/40"
                    aria-hidden
                    strokeWidth={1.75}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </nav>
  )
}
