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
  /** Controlled current step. Omit to let the wizard own it (use with `onStepChange` to observe). */
  stepIndex?: number
  onStepChange?: (index: number) => void
  /** Parent-owned error (e.g. a failed submit) shown above the footer. */
  stepError?: ReactNode
  /** Accessible name for the stepper list. */
  ariaLabel?: string
  /** Enter inside a single-line input of the step body runs the same action as Next. Off by default. */
  advanceOnEnter?: boolean
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
  stepIndex: controlledIndex,
  onStepChange,
  stepError,
  ariaLabel,
  advanceOnEnter = false,
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
  const maxIndex = Math.max(steps.length - 1, 0)
  const [ownIndex, setOwnIndex] = useState(() => Math.min(Math.max(initialStep, 0), maxIndex))
  const stepIndex = Math.min(Math.max(controlledIndex ?? ownIndex, 0), maxIndex)
  const setStepIndex = (update: number | ((current: number) => number)) => {
    const value = typeof update === "function" ? update(stepIndex) : update
    const clamped = Math.min(Math.max(value, 0), maxIndex)
    setOwnIndex(clamped)
    onStepChange?.(clamped)
  }
  const [validationError, setValidationError] = useState<string | null>(null)
  const isFinalStep = stepIndex === steps.length - 1

  function goTo(index: number) {
    setValidationError(null)
    setStepIndex(index)
  }

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
        <WizardPanelsStepper steps={steps} currentIndex={stepIndex} onStepClick={goTo} ariaLabel={ariaLabel} />
      </div>
      <div className="sm:hidden">
        <WizardPanelsStepper steps={steps} currentIndex={stepIndex} onStepClick={goTo} ariaLabel={ariaLabel} variant="compact" />
      </div>

      <div
        className="mt-4"
        onKeyDown={advanceOnEnter ? (event) => {
          if (event.key !== "Enter" || isFinalStep || busy || event.defaultPrevented) return
          const target = event.target
          if (target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(target.type)) {
            event.preventDefault()
            void next()
          }
        } : undefined}
      >
        {isFinalStep && finalReview ? finalReview : children(stepIndex)}
      </div>

      {validationError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}
      {stepError ? <div className="mt-3 text-sm text-destructive" role="alert">{stepError}</div> : null}

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
          <Button type="button" className="max-md:flex-1" disabled={busy || finishDisabled} onClick={() => void onFinish()}>
            {finishLabel}
          </Button>
        ) : (
          <Button type="button" className="max-md:flex-1" disabled={busy} onClick={() => void next()}>
            {nextLabel}
          </Button>
        )}
      </div>
    </section>
  )
}
