import { planningPermissions } from "./allocationActions"

export const PLANNING_MODULE = "resource-planning"

/** Availability settings need the Resource planning module and the write permission. */
export function canEditAvailability(activeModules: readonly string[], can: (permission: string) => boolean): boolean {
  return activeModules.includes(PLANNING_MODULE) && can(planningPermissions.availability)
}
