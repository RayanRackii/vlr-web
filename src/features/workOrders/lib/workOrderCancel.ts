import { useCallback } from "react"

import { usePermissions } from "@/features/users/permissions/PermissionContext"

const CANCELABLE_STATUSES: readonly string[] = ["Pending", "Scheduled", "InProgress"]

export const WORK_ORDER_CREATE_PERMISSION = "os.work_orders.create"
export const WORK_ORDER_EXECUTE_PERMISSION = "os.work_orders.execute"

export type CancelableWorkOrder = {
  status: string
  assignedUserId?: string | null
  assignedUser?: { id?: string | null } | null
}

export function isCancelableStatus(status: string): boolean {
  return CANCELABLE_STATUSES.includes(status)
}

/**
 * Mirrors the API rule: `create` may cancel any open order, `execute` only the
 * orders assigned to the current user. Closed orders are never cancelable.
 */
export function useCanCancelWorkOrder(): (order: CancelableWorkOrder) => boolean {
  const { can, currentUser } = usePermissions()
  const userId = currentUser?.id ?? null
  const canCreate = can(WORK_ORDER_CREATE_PERMISSION)
  const canExecute = can(WORK_ORDER_EXECUTE_PERMISSION)

  return useCallback(
    (order) => {
      if (!isCancelableStatus(order.status)) return false
      if (canCreate) return true
      if (!canExecute || !userId) return false
      const assignee = order.assignedUserId ?? order.assignedUser?.id ?? null
      return assignee === userId
    },
    [canCreate, canExecute, userId],
  )
}
