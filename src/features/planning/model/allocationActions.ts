import type { PlanningAllocation } from "../schemas/planningSchemas"

export const planningPermissions = {
  read: "resource-planning.agenda.read",
  manage: "resource-planning.allocations.manage",
  execute: "resource-planning.allocations.execute",
  availability: "resource-planning.availability.write",
} as const

type Can = (permission: string) => boolean

export type AllocationActions = {
  edit: boolean
  start: boolean
  workFinished: boolean
  release: boolean
  cancel: boolean
  /** Owned by an order or work-order flow: no actions here, only a pointer to it. */
  orderWorkflow: boolean
}

/** Admins hold `allocations.manage`; a technician holds `allocations.execute`. */
export const canCreateAllocation = (can: Can) => can(planningPermissions.manage) || can(planningPermissions.execute)

/** Creating, editing or running an `Unavailable` block takes the asset out of service: admin-level. */
export const canCloseAssets = (can: Can) => can(planningPermissions.availability) || can(planningPermissions.manage)

export function allocationActions(allocation: PlanningAllocation, can: Can, userId: string | null): AllocationActions {
  const none: AllocationActions = { edit: false, start: false, workFinished: false, release: false, cancel: false, orderWorkflow: false }
  if (allocation.source !== "Manual") return { ...none, orderWorkflow: allocation.source !== "" }

  const canRun = canCreateAllocation(can)
  const isAdmin = can(planningPermissions.manage)
  const mayRun = canRun && (allocation.kind !== "Unavailable" || canCloseAssets(can))
  const scheduled = allocation.status === "Scheduled"
  const isCreator = userId !== null && allocation.createdByUserId === userId
  return {
    ...none,
    // UX choice: an expired Scheduled allocation no longer blocks and cannot be started, so editing it is hidden too.
    edit: isAdmin && scheduled && !allocation.isExpired,
    start: mayRun && scheduled && !allocation.isExpired,
    workFinished: mayRun && allocation.status === "Running",
    release: mayRun && allocation.status === "Cleaning",
    // Cancelling someone else's allocation is admin-only.
    cancel: canRun && scheduled && (isAdmin || isCreator),
  }
}
