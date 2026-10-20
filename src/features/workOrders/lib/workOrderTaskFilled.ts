import { isWorkOrderImageFileId } from "@/features/workOrders/lib/workOrderImageRules"
import type { WorkOrderTask } from "@/features/workOrders/schemas/workOrderSchemas"

/**
 * Mirrors `WorkOrderTaskValues.IsFilled`: an image counts only when the value
 * is a stored file id, and a checkbox counts only when it is exactly "true".
 * The server still checks that the id belongs to the task.
 */
export function isWorkOrderTaskFilled(
  task: Pick<WorkOrderTask, "inputType">,
  value: string | null,
): boolean {
  if (task.inputType === "Image") {
    return isWorkOrderImageFileId(value)
  }

  if (task.inputType === "Checkbox") {
    return value === "true"
  }

  return value != null && value.trim() !== ""
}
