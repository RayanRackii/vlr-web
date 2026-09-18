import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { makeWorkOrder, WORK_ORDER_ID } from "@/features/workOrders/test/workOrderFixtures"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import i18n from "@/lib/i18n"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/lib/offlineSync", () => ({
  processSyncQueue: vi.fn(async () => undefined),
  enqueueTaskValuePatch: vi.fn(),
  isNetworkConnectivityError: () => false,
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => ({
  getWorkOrderById: vi.fn(),
  updateTaskValue: vi.fn(),
  updateWorkOrderStatus: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getPlan: vi.fn(async () => {
    throw new Error("must not fetch live plan name")
  }),
}))

import { getPlan } from "@/features/pmoc/services/pmocService"
import { getWorkOrderById } from "@/features/workOrders/services/workOrdersService"

const getWorkOrderByIdMock = vi.mocked(getWorkOrderById)
const getPlanMock = vi.mocked(getPlan)

function renderExecution(
  permissions: readonly string[],
  activeModules: readonly string[],
) {
  return render(
    <MemoryRouter initialEntries={[`/os/${WORK_ORDER_ID}`]}>
      <TestPermissionProvider
        permissions={permissions}
        activeModules={activeModules}
      >
        <Routes>
          <Route path="/os/:id" element={<WorkOrderExecutionPage />} />
          <Route path="/pmoc/:id" element={<div>pmoc-detail</div>} />
          <Route path="/os" element={<div>os-list</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("WorkOrderExecutionPage origin", () => {
  beforeEach(() => {
    getWorkOrderByIdMock.mockReset()
    getPlanMock.mockClear()
  })

  it("H: generated work order detail shows PMOC origin", async () => {
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({ sourcePlanName: "Nome histórico do plano" }),
    )

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByText("PMOC · Nome histórico do plano"),
    ).toBeInTheDocument()
  })

  it("I: links back to PMOC detail when plans.read and pmoc module are active", async () => {
    getWorkOrderByIdMock.mockResolvedValue(makeWorkOrder())

    renderExecution(
      ["os.work_orders.read", "pmoc.plans.read"],
      ["os", "pmoc"],
    )

    const link = await screen.findByRole("link", {
      name: i18n.t("workOrders.origin.viewPlan"),
    })
    expect(link).toHaveAttribute("href", `/pmoc/${PLAN_ID}`)
  })

  it("J: manual work order does not show a broken PMOC link", async () => {
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({
        maintenancePlanId: null,
        sourcePlanName: null,
      }),
    )

    renderExecution(
      ["os.work_orders.read", "pmoc.plans.read"],
      ["os", "pmoc"],
    )

    expect(
      await screen.findByText(i18n.t("workOrders.origin.manual")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", {
        name: i18n.t("workOrders.origin.viewPlan"),
      }),
    ).not.toBeInTheDocument()
  })

  it("K: displays sourcePlanName as historical metadata and does not fetch the live plan name", async () => {
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({ sourcePlanName: "Nome histórico do plano" }),
    )

    renderExecution(
      ["os.work_orders.read", "pmoc.plans.read"],
      ["os", "pmoc"],
    )

    expect(
      await screen.findByText("PMOC · Nome histórico do plano"),
    ).toBeInTheDocument()
    expect(screen.queryByText("PMOC Split Mensal")).not.toBeInTheDocument()
    expect(getPlanMock).not.toHaveBeenCalled()
  })

  it("does not link to PMOC for technicians without pmoc access", async () => {
    getWorkOrderByIdMock.mockResolvedValue(makeWorkOrder())

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByText("PMOC · PMOC Split Mensal"),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", {
        name: i18n.t("workOrders.origin.viewPlan"),
      }),
    ).not.toBeInTheDocument()
  })
})
