import { useFormState, type FieldValues, type UseFormReturn, type Path } from "react-hook-form"
import { ZodError } from "zod"

/** Validity is calculated separately; only interacted fields explain errors before submit. */
export function useVisibleFormIssues<T extends FieldValues>(
  error: ZodError | undefined,
  form: UseFormReturn<T>,
): ZodError | undefined {
  const state = useFormState({ control: form.control })
  // Subscribe to both maps even while there are no issues.
  const { isSubmitted, touchedFields, dirtyFields } = state
  void touchedFields
  void dirtyFields
  if (!error || isSubmitted) return error

  const issues = error.issues.filter((issue) => {
    const field = form.getFieldState(issue.path.join(".") as Path<T>, state)
    return field.isTouched || field.isDirty
  })
  return issues.length ? new ZodError(issues) : undefined
}
