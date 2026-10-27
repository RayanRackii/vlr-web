import { useFormState, type FieldValues, type UseFormReturn, type Path } from "react-hook-form"
import { ZodError } from "zod"

/** Validity is calculated separately; only touched fields explain errors before submit. */
export function useVisibleFormIssues<T extends FieldValues>(
  error: ZodError | undefined,
  form: UseFormReturn<T>,
): ZodError | undefined {
  const state = useFormState({ control: form.control })
  // Subscribe even while there are no issues, so blur reveals the next error.
  const { isSubmitted, touchedFields } = state
  void touchedFields
  if (!error || isSubmitted) return error

  const issues = error.issues.filter((issue) => {
    const field = form.getFieldState(issue.path.join(".") as Path<T>, state)
    return field.isTouched
  })
  return issues.length ? new ZodError(issues) : undefined
}
