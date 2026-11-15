import { createContext, useContext, useEffect, useRef } from "react"

/**
 * Saves the current cadastro step. Resolves `true` when it saved (or had nothing to save) and the
 * wizard may move on; `false` when validation or the request failed. The step keeps its values
 * and shows its own errors on failure.
 */
export type StepSubmit = () => Promise<boolean>

export type StepSubmitRegistry = {
  /** The step that is mounted registers its submit; `null` when it unmounts. */
  register: (submit: StepSubmit | null) => void
}

/** Provided by the cadastro shell; absent everywhere else (e.g. the product editor tabs). */
export const StepSubmitContext = createContext<StepSubmitRegistry | null>(null)

/**
 * Lets the cadastro footer ("Salvar e continuar" / "Salvar e sair") save the current step.
 * Returns `true` when a shell drives saving — the step must then hide its own Save button.
 * Outside a shell it returns `false` and the step keeps its own Save button.
 */
export function useStepSubmit(submit: StepSubmit): boolean {
  const registry = useContext(StepSubmitContext)
  const latest = useRef(submit)
  useEffect(() => {
    latest.current = submit
  })
  useEffect(() => {
    if (!registry) return
    registry.register(() => latest.current())
    return () => registry.register(null)
  }, [registry])
  return registry != null
}
