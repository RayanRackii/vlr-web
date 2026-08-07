import { Check } from "lucide-react"

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
 * Horizontal chevron panels stepper (Tailwind UI “Panels” pattern).
 * Uses theme primary — not a fixed purple accent.
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
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <ol className="flex divide-x divide-border overflow-x-auto">
        {steps.map((step, index) => {
          const status =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming"
          const clickable =
            Boolean(onStepClick) && index < currentIndex

          return (
            <li key={step.id} className="relative min-w-[8.5rem] flex-1">
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
                  "group flex w-full items-center gap-3 px-4 py-3 text-left text-sm",
                  clickable && "cursor-pointer hover:bg-muted/40",
                  !clickable && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    status === "complete" &&
                      "border-primary bg-primary text-primary-foreground",
                    status === "current" &&
                      "border-primary text-primary",
                    status === "upcoming" &&
                      "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {status === "complete" ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span
                  className={cn(
                    "truncate font-medium",
                    status === "complete" && "text-foreground",
                    status === "current" && "text-primary",
                    status === "upcoming" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-4 translate-x-1/2 sm:block"
                >
                  <svg
                    className="h-full w-full text-border"
                    viewBox="0 0 12 80"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path
                      d="M0 0 L12 40 L0 80"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </svg>
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
