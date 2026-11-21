import { describe, expect, it } from "vitest"

import { selectStaffDashboard } from "@/features/dashboard/lib/selectStaffDashboard"

const technicianPermissions = [
  "core.dashboard.read",
  "os.work_orders.read",
  "os.work_orders.execute",
  "inventory.assets.read",
  "resource-planning.agenda.read",
]

describe("selectStaffDashboard", () => {
  it("gives the work-order view to a user limited to work orders in a tenant with os", () => {
    expect(
      selectStaffDashboard({ role: "TECHNICIAN", permissions: technicianPermissions, activeModules: ["os", "inventory"] }),
    ).toBe("workOrders")
  })

  it("does not pick the work-order view for a legacy USER of a rentals-only tenant", () => {
    expect(
      selectStaffDashboard({
        role: "USER",
        permissions: ["core.dashboard.read", "rentals.reservations.read", "rentals.schedule.read"],
        activeModules: ["rentals"],
      }),
    ).toBe("tenant")
  })

  it("does not pick it when the tenant has no os module even if the key is present", () => {
    expect(
      selectStaffDashboard({ role: "TECHNICIAN", permissions: technicianPermissions, activeModules: ["rentals"] }),
    ).toBe("tenant")
  })

  it("does not pick it for a user with broader read permissions", () => {
    expect(
      selectStaffDashboard({
        role: "USER",
        permissions: [...technicianPermissions, "rentals.reservations.read"],
        activeModules: ["os", "rentals"],
      }),
    ).toBe("tenant")
  })

  it("keeps the client view for the CLIENT role and the tenant view for unknown roles", () => {
    expect(selectStaffDashboard({ role: "CLIENT", permissions: [], activeModules: [] })).toBe("client")
    expect(selectStaffDashboard({ role: "SUPERVISOR", permissions: ["core.dashboard.read"], activeModules: [] })).toBe("tenant")
  })
})
