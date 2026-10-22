import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { WizardPanelsStepper } from "@/components/ui/wizard-panels"

export type WizardStep = {
  id: string
  label: string
  /** Return a translated message to keep the user on the current step. */
  validate?: () => string | null | Promise<string | null>
}

type WizardProps = {
  steps: readonly WizardStep[]
  initialStep?: number
  children: (stepIndex: number) => ReactNode
  finalReview?: ReactNode
  nextLabel: string
  backLabel: string
  finishLabel: string
  onFinish: () => void | Promise<void>
  finishDisabled?: boolean
  busy?: boolean
  className?: string
}

/**
 * Shared, consumer-owned wizard shell. Step content and validation remain with
 * each feature, so the shell has no domain assumptions.
 */
export function Wizard({
  steps,
  initialStep = 0,
  children,
  finalReview,
  nextLabel,
  backLabel,
  finishLabel,
  onFinish,
  finishDisabled = false,
  busy = false,
  className,
}: WizardProps) {
  const [stepIndex, setStepIndex] = useState(() =>
    Math.min(Math.max(initialStep, 0), Math.max(steps.length - 1, 0)),
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const isFinalStep = stepIndex === steps.length - 1

  async function next() {
    const message = await steps[stepIndex]?.validate?.()
    if (message) {
      setValidationError(message)
      return
    }
    setValidationError(null)
    setStepIndex((current) => Math.min(current + 1, steps.length - 1))
  }

  return (
    <section className={className}>
      <div className="hidden sm:block">
        <WizardPanelsStepper steps={steps} currentIndex={stepIndex} onStepClick={setStepIndex} />
      </div>
      <div className="sm:hidden">
        <WizardPanelsStepper steps={steps} currentIndex={stepIndex} onStepClick={setStepIndex} variant="compact" />
      </div>

      <div className="mt-4">
        {isFinalStep && finalReview ? finalReview : children(stepIndex)}
      </div>

      {validationError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={stepIndex === 0 || busy}
          onClick={() => {
            setValidationError(null)
            setStepIndex((current) => Math.max(current - 1, 0))
          }}
        >
          {backLabel}
        </Button>
        {isFinalStep ? (
          <Button type="button" disabled={busy || finishDisabled} onClick={() => void onFinish()}>
            {finishLabel}
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => void next()}>
            {nextLabel}
          </Button>
        )}
      </div>
    </section>
  )
}
