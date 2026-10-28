import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantAdminDashboard } from "./DashboardPage"
import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"
import { getDashboardMetrics } from "@/features/dashboard/services/dashboardService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "staff-user" } } }),
}))
vi.mock("@/features/dashboard/services/dashboardService", () => ({ getDashboardMetrics: vi.fn() }))

const emptyMetrics: DashboardMetrics = {
  customerActivity: { loggedInToday: 0, loggedInLast7Days: 0, loggedInLast30Days: 0, totalCustomers: 0 },
  assets: { total: 0, active: 0, inMaintenance: 0, inactive: 0, byFamily: [] },
  workOrders: { totalThisMonth: 0, pending: 0, inProgress: 0, completed: 0, canceled: 0 },
  pmoc: null,
  maintenance: null,
  rentals: null,
}

function renderDashboard() {
  render(<MemoryRouter><TestPermissionProvider><TenantAdminDashboard /></TestPermissionProvider></MemoryRouter>)
}

describe("staff dashboard states", () => {
  beforeEach(() => { vi.mocked(getDashboardMetrics).mockReset() })

  it("offers a retry after a failed load and then displays the recovered indicators", async () => {
    vi.mocked(getDashboardMetrics).mockRejectedValueOnce(new Error("Metrics unavailable")).mockResolvedValueOnce(emptyMetrics)
    renderDashboard()
    expect(await screen.findByRole("alert")).toHaveTextContent("Metrics unavailable")
    expect(screen.getByText("Os indicadores não estão disponíveis no momento.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(await screen.findByText("Nenhum recurso cadastrado ainda.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows calm explanations for empty charts instead of a blank plot", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue(emptyMetrics)
    renderDashboard()
    expect(await screen.findByText("Nenhum recurso cadastrado ainda.")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma família ativa.")).toBeInTheDocument()
    expect(screen.getByText("Nenhuma ordem de serviço para exibir neste período.")).toBeInTheDocument()
  })

  it("explains when there are no operational modules without treating it as an error", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue({ ...emptyMetrics, assets: null, workOrders: null })
    renderDashboard()
    expect(await screen.findByText("Nenhum módulo operacional ativo além do portal de clientes.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
