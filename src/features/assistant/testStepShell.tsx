import { useMemo, useRef, type ReactNode } from "react"
import { StepSubmitContext, type StepSubmit } from "./stepSubmit"

/** Test double of the cadastro shell: provides the registry and exposes the footer submit. */
export function createStepShell() {
  const result: { current: boolean | null; submit: () => Promise<boolean | null> } = {
    current: null,
    submit: async () => null,
  }
  function StepShell({ children }: { children: ReactNode }) {
    const submitRef = useRef<StepSubmit | null>(null)
    const registry = useMemo(() => ({ register: (submit: StepSubmit | null) => { submitRef.current = submit } }), [])
    result.submit = async () => {
      const value = submitRef.current ? await submitRef.current() : null
      result.current = value
      return value
    }
    return <StepSubmitContext.Provider value={registry}>{children}</StepSubmitContext.Provider>
  }
  return { StepShell, shell: result }
}
