import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Card section of a form page: title (h2), optional description and actions. */
export function FormSection({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** Field grid: one column, or two from the sm breakpoint. */
export function FormGrid({
  columns = 1,
  children,
}: {
  columns?: 1 | 2
  children: ReactNode
}) {
  return <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>{children}</div>
}

type ControlProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  "aria-required"?: boolean
}

/**
 * One field row: label above the control, hint under the label, error under
 * the control. When `children` is a single element it receives `id={htmlFor}`,
 * `aria-describedby` (hint/error ids) and `aria-invalid` on error.
 */
export function FormRow({
  label,
  htmlFor,
  hint,
  required = false,
  error,
  span = 1,
  children,
}: {
  label: ReactNode
  htmlFor: string
  hint?: ReactNode
  required?: boolean
  error?: ReactNode
  span?: 1 | 2
  children: ReactNode
}) {
  const hintId = `${htmlFor}-hint`
  const errorId = `${htmlFor}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ")

  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id: htmlFor,
        "aria-describedby":
          [children.props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-required": required ? true : children.props["aria-required"],
      })
    : children

  return (
    <div className={cn("min-w-0 space-y-1.5", span === 2 && "sm:col-span-2")}>
      <Label
        htmlFor={htmlFor}
        className={cn(
          "leading-normal",
          // Generated content keeps the marker out of the label's text and accessible name.
          required && "after:-ml-1 after:text-destructive after:content-['*']",
        )}
      >
        {label}
      </Label>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
