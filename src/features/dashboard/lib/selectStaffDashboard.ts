export type StaffDashboardKind = "workOrders" | "client" | "tenant"

const WORK_ORDERS_READ = "os.work_orders.read"

/** Permissions a field technician normally holds besides work orders (assets, planning agenda). */
const TECHNICIAN_COMPATIBLE_KEYS: ReadonlySet<string> = new Set([
  "core.dashboard.read",
  "inventory.assets.read",
])
const TECHNICIAN_COMPATIBLE_PREFIXES = ["os.", "resource-planning."] as const

function isBroaderAccess(permission: string): boolean {
  if (TECHNICIAN_COMPATIBLE_KEYS.has(permission)) return false
  return !TECHNICIAN_COMPATIBLE_PREFIXES.some((prefix) => permission.startsWith(prefix))
}

/**
 * Picks the staff home dashboard from what the user can actually do, not from the legacy
 * `role` string: the work-order view is only for someone who reads work orders in a tenant
 * that has the work-order module and holds no broader permission (reservations, catalog, ...).
 * Everyone else gets the tenant dashboard, whose sections follow modules and permissions.
 */
export function selectStaffDashboard(user: {
  role: string
  permissions: readonly string[]
  activeModules: readonly string[]
}): StaffDashboardKind {
  if (user.role === "CLIENT") return "client"

  const hasWorkOrderModule = user.activeModules.some(
    (module) => module.trim().toLowerCase() === "os",
  )
  if (
    hasWorkOrderModule &&
    user.permissions.includes(WORK_ORDERS_READ) &&
    !user.permissions.some(isBroaderAccess)
  ) {
    return "workOrders"
  }
  return "tenant"
}
