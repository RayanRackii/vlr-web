import { render, screen, within } from "@testing-library/react"
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

function renderDashboard(permissions: string[] = [], activeModules: string[] = []) {
  render(<MemoryRouter><TestPermissionProvider permissions={permissions} activeModules={activeModules}><TenantAdminDashboard /></TestPermissionProvider></MemoryRouter>)
}

describe("staff dashboard states", () => {
  beforeEach(() => { vi.mocked(getDashboardMetrics).mockReset() })

  it("presents one command center heading and quick links using existing navigation access", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue(emptyMetrics)
    renderDashboard(["os.work_orders.read", "inventory.assets.read"], ["os", "inventory"])
    expect(await screen.findByRole("heading", { level: 1, name: "Centro de Comando" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    const quickAccess = await screen.findByRole("navigation", { name: "Acesso rápido" })
    expect(quickAccess).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Equipamentos.*Abrir/ })).toHaveAttribute("href", "/ativos")
    expect(screen.getByRole("link", { name: /Ordens de serviço.*Abrir/ })).toHaveAttribute("href", "/os")
    expect(screen.queryByRole("link", { name: /Reservas/ })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Clientes no portal" })).toBeInTheDocument()
  })

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
    expect(screen.queryByRole("navigation", { name: "Acesso rápido" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Clientes no portal" })).not.toBeInTheDocument()
  })

  it("shows the loaded daily pulse and textual chart counts without counting canceled reservations", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue({
      ...emptyMetrics,
      rentals: {
        reservationsTodayPendingDeposit: 3, reservationsTodayConfirmed: 8,
        reservationsTodayCompleted: 1, reservationsTodayCanceled: 6,
        confirmationRateLast7Days: 87, slotsBookedToday: 28, slotsAvailableToday: 12,
        reservedRevenueThisMonth: 8420, rentableSpaces: 6, rentableGoods: 2,
      },
      workOrders: { totalThisMonth: 36, pending: 5, inProgress: 8, completed: 23, canceled: 0 },
      maintenance: { assetsInMaintenance: 2, openWorkOrders: 7 },
      assets: { total: 50, active: 42, inMaintenance: 2, inactive: 6, byFamily: [{ key: "spaces", label: "Espaços", count: 18 }] },
    })
    renderDashboard(["rentals.reservations.read", "os.work_orders.read"], ["rentals", "os"])
    const hero = screen.getByRole("banner")
    expect(await within(hero).findByText("28/40")).toBeInTheDocument()
    expect(within(hero).getByText("12 livres")).toBeInTheDocument()
    expect(within(hero).getByText("12", { selector: "strong" })).toBeInTheDocument()
    expect(within(hero).getByText("3 aguardando · 8 confirmadas")).toBeInTheDocument()
    expect(within(hero).getByRole("link", { name: "Reservas" })).toHaveAttribute("href", "/configuracoes/reservas")
    const orders = screen.getByRole("region", { name: "Status das ordens de serviço" })
    expect(within(orders).getByText("23")).toBeInTheDocument()
    expect(within(orders).getByText("Em andamento")).toBeInTheDocument()
    const assets = screen.getByRole("region", { name: "Status dos recursos" })
    expect(within(assets).getByText("42")).toBeInTheDocument()
    expect(within(assets).getByText("Inativos")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Por família" })).toHaveTextContent("Espaços18")
    expect(screen.getByRole("region", { name: "Manutenção" })).toHaveTextContent("OS abertas7")
  })

  it("omits slot occupancy for OpenHours data and retains zero-valued supported indicators", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue({
      ...emptyMetrics,
      rentals: {
        reservationsTodayPendingDeposit: 0, reservationsTodayConfirmed: 0,
        reservationsTodayCompleted: 0, reservationsTodayCanceled: 0,
        confirmationRateLast7Days: 0, slotsBookedToday: 0, slotsAvailableToday: 0,
        reservedRevenueThisMonth: 0, rentableSpaces: 1, rentableGoods: 0,
      },
    })
    renderDashboard()
    expect(await screen.findByRole("heading", { name: "Aluguéis" })).toBeInTheDocument()
    expect(within(screen.getByRole("banner")).getAllByText("0", { selector: "strong" })).toHaveLength(2)
    expect(screen.queryByText("Slots hoje")).not.toBeInTheDocument()
    expect(screen.queryByText("0/0")).not.toBeInTheDocument()
    expect(screen.getByText("Receita reservada")).toBeInTheDocument()
  })
})
