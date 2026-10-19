import { useTranslation } from "react-i18next"

export type TaskSaveState = "idle" | "saving" | "saved" | "retrying"

export function TaskSaveIndicator({
  state,
  taskTitle,
}: {
  state: TaskSaveState
  taskTitle: string
}) {
  const { t } = useTranslation()

  if (state === "idle") {
    return null
  }

  const label = t(`workOrders.execution.save.${state}`)

  return (
    <p
      className={
        state === "retrying"
          ? "text-xs text-amber-800 dark:text-amber-200"
          : "text-xs text-muted-foreground"
      }
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${taskTitle}: ${label}`}
    >
      {label}
    </p>
  )
}
