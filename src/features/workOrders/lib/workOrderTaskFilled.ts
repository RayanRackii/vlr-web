import type { WorkOrderTask } from "@/features/workOrders/schemas/workOrderSchemas"

/**
 * Mirrors `WorkOrderTaskValues.IsFilled`: image tasks never block completion,
 * and a checkbox counts only when the stored value is exactly "true".
 */
export function isWorkOrderTaskFilled(
  task: Pick<WorkOrderTask, "inputType">,
  value: string | null,
): boolean {
  if (task.inputType === "Image") {
    return true
  }

  if (task.inputType === "Checkbox") {
    return value === "true"
  }

  return value != null && value.trim() !== ""
}
