import { isWorkOrderTaskFilled } from "@/features/workOrders/lib/workOrderTaskFilled"
import type { WorkOrderTask } from "@/features/workOrders/schemas/workOrderSchemas"

export type MandatoryTaskRef = Pick<
  WorkOrderTask,
  "id" | "title" | "inputType" | "isMandatory" | "order"
>

/**
 * A required photo counts only when it has a stored answer.
 * Blank is incomplete here. A non-blank image still goes through
 * `isWorkOrderTaskFilled`, which the upload change tightens to a file id.
 */
export function isTaskAnswerFilled(
  task: Pick<WorkOrderTask, "inputType">,
  value: string | null,
): boolean {
  if (task.inputType === "Image" && (value == null || value.trim() === "")) {
    return false
  }

  return isWorkOrderTaskFilled(task, value)
}

export function isMandatoryTaskComplete(
  task: Pick<WorkOrderTask, "inputType" | "isMandatory">,
  value: string | null,
): boolean {
  if (!task.isMandatory) {
    return true
  }

  return isTaskAnswerFilled(task, value)
}

export function listMissingMandatoryTaskTitles(
  tasks: readonly MandatoryTaskRef[],
  valueOf: (task: MandatoryTaskRef) => string | null,
): string[] {
  return [...tasks]
    .sort((left, right) => left.order - right.order)
    .filter((task) => !isMandatoryTaskComplete(task, valueOf(task)))
    .map((task) => task.title.trim())
    .filter((title) => title !== "")
}

export function mergeMissingMandatoryTitles(
  clientTitles: readonly string[],
  serverTitles: readonly string[],
): string[] {
  const merged = [...clientTitles]
  for (const title of serverTitles) {
    const trimmed = title.trim()
    if (trimmed === "" || merged.includes(trimmed)) {
      continue
    }

    merged.push(trimmed)
  }

  return merged
}
