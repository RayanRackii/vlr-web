import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicianDashboard } from "./TechnicianDashboard"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

vi.mock("@/features/workOrders/services/workOrdersService", () => ({ getWorkOrders: vi.fn() }))

function renderDashboard(permissions: string[]) {
  render(<MemoryRouter><TestPermissionProvider permissions={permissions} activeModules={["os"]}><TechnicianDashboard /></TestPermissionProvider></MemoryRouter>)
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

  it("explains limited access calmly without suggesting an unavailable work-order page", () => {
    renderDashboard([])
    expect(screen.getByRole("status")).toHaveTextContent("Seu acesso permite consultar")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Ver ordens de serviço" })).not.toBeInTheDocument()
  })

  it("offers the existing work-order list when there are no active orders", async () => {
    vi.mocked(getWorkOrders).mockResolvedValue([])
    renderDashboard(["os.work_orders.read"])
    expect(await screen.findByText("Nenhuma ordem de serviço atribuída no momento.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ver ordens de serviço" })).toHaveAttribute("href", "/os")
  })

  it("does not claim the list is empty on failure and lets the user retry", async () => {
    vi.mocked(getWorkOrders).mockRejectedValueOnce(new Error("OS unavailable")).mockResolvedValueOnce([])
    renderDashboard(["os.work_orders.read"])
    await screen.findByRole("alert")
    expect(screen.queryByText("Nenhuma ordem de serviço atribuída no momento.")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(await screen.findByText("Nenhuma ordem de serviço atribuída no momento.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
