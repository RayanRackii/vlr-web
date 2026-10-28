import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicianDashboard } from "./TechnicianDashboard"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

vi.mock("@/features/workOrders/services/workOrdersService", () => ({ getWorkOrders: vi.fn() }))

function renderDashboard(permissions: string[]) {
  render(<MemoryRouter><TestPermissionProvider permissions={permissions}><TechnicianDashboard /></TestPermissionProvider></MemoryRouter>)
}

describe("maintenance dashboard permissions", () => {
  beforeEach(() => { vi.mocked(getWorkOrders).mockReset() })

  it("does not request OS or show their error banner without OS permission (User)", async () => {
    vi.mocked(getWorkOrders).mockRejectedValue(new Error("OS unavailable"))
    renderDashboard([])
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
    expect(getWorkOrders).not.toHaveBeenCalled()
  })

  it("shows OS errors for users with the existing OS read permission", async () => {
    vi.mocked(getWorkOrders).mockRejectedValue(new Error("OS unavailable"))
    renderDashboard(["os.work_orders.read"])
    expect(await screen.findByRole("alert")).toHaveTextContent("OS unavailable")
  })
})
