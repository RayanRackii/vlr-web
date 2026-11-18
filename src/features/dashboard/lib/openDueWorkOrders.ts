/** OS card value: pending + in progress due up to today; older APIs only send `pending`. */
export function openDueWorkOrders(workOrders: { pending: number; openDue?: number }): number {
  return workOrders.openDue ?? workOrders.pending
}
