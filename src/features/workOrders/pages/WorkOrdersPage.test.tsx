import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkOrdersPage } from "@/features/workOrders/pages/WorkOrdersPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import i18n from "@/lib/i18n"

const authSession = vi.hoisted(() => ({ access_token: "test" }))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => ({
  getWorkOrders: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getPlan: vi.fn(async () => {
    throw new Error("must not fetch live plan name")
  }),
}))

import { getPlan } from "@/features/pmoc/services/pmocService"
import { getWorkOrders } from "@/features/workOrders/services/workOrdersService"

const getWorkOrdersMock = vi.mocked(getWorkOrders)
const getPlanMock = vi.mocked(getPlan)

function renderList(
  permissions: readonly string[],
  activeModules: readonly string[],
) {
  return render(
    <MemoryRouter initialEntries={["/os"]}>
      <TestPermissionProvider
        permissions={permissions}
        activeModules={activeModules}
      >
        <Routes>
          <Route path="/os" element={<WorkOrdersPage />} />
          <Route path="/pmoc/:id" element={<div>pmoc-detail</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("WorkOrdersPage origin", () => {
  beforeEach(() => {
    getWorkOrdersMock.mockReset()
    getPlanMock.mockClear()
  })

  it.each([
    ["os.work_orders.read"],
    ["os.work_orders.read", "os.work_orders.execute"],
  ])("offers completed orders from the empty open list for %j", async (...permissions) => {
    const user = userEvent.setup()
    getWorkOrdersMock.mockResolvedValue([makeWorkOrder({ status: "Completed" })])
    renderList(permissions, ["os"])

    await user.click(await screen.findByRole("button", {
      name: i18n.t("workOrders.actions.viewCompleted"),
    }))

    expect(screen.getByRole("tab", {
      name: i18n.t("workOrders.tabs.withCount", {
        label: i18n.t("workOrders.tabs.Completed"), count: 1,
      }),
    })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("link", {
      name: i18n.t("workOrders.actions.view"),
    })).toHaveAttribute("href", `/os/${makeWorkOrder().id}`)
    expect(getWorkOrdersMock).toHaveBeenCalledTimes(1)
  })

  it("does not offer completed orders when none exist", async () => {
    getWorkOrdersMock.mockResolvedValue([])
    renderList(["os.work_orders.read"], ["os"])

    await screen.findByText(i18n.t("workOrders.empty.Open"))
    expect(screen.queryByRole("button", {
      name: i18n.t("workOrders.actions.viewCompleted"),
    })).not.toBeInTheDocument()
  })

  it("H/K: generated work orders show historical PMOC origin metadata", async () => {
    getWorkOrdersMock.mockResolvedValue([
      makeWorkOrder({ sourcePlanName: "Nome histórico do plano" }),
    ])

    renderList(
      ["os.work_orders.read", "pmoc.plans.read"],
      ["os", "pmoc"],
    )

    const planLink = await screen.findByRole("link", {
      name: i18n.t("workOrders.origin.viewPlan"),
    })
    expect(planLink.closest("tr")?.textContent).toMatch(
      /Nome histórico do plano/,
    )
    expect(getPlanMock).not.toHaveBeenCalled()
  })

  it("I: links back to the PMOC plan when the user can read plans", async () => {
    getWorkOrdersMock.mockResolvedValue([makeWorkOrder()])
    renderList(
      ["os.work_orders.read", "pmoc.plans.read"],
      ["os", "pmoc"],
    )

    const link = await screen.findByRole("link", {
      name: i18n.t("workOrders.origin.viewPlan"),
    })
    expect(link).toHaveAttribute("href", `/pmoc/${PLAN_ID}`)
  })

  it("J: manual work orders show Manual origin without a PMOC link", async () => {
    getWorkOrdersMock.mockResolvedValue([
      makeWorkOrder({
        maintenancePlanId: null,
        sourcePlanName: null,
      }),
    ])

    renderList(
      ["os.work_orders.read", "pmoc.plans.read"],
      ["os", "pmoc"],
    )

    const execute = await screen.findByRole("link", {
      name: i18n.t("workOrders.actions.execute"),
    })
    expect(execute).toHaveAttribute("href", `/os/${makeWorkOrder().id}`)
    expect(execute.closest("tr")?.textContent).toMatch(
      i18n.t("workOrders.origin.manual"),
    )
    expect(
      screen.queryByRole("link", {
        name: i18n.t("workOrders.origin.viewPlan"),
      }),
    ).not.toBeInTheDocument()
  })

  it("shows in-progress work orders on the default open filter", async () => {
    const user = userEvent.setup()
    const pending = makeWorkOrder()
    const inProgress = makeWorkOrder({
      id: "88888888-8888-4888-8888-888888888888",
      status: "InProgress",
    })
    getWorkOrdersMock.mockResolvedValue([pending, inProgress])

    renderList(["os.work_orders.read"], ["os"])

    const openTab = await screen.findByRole("tab", {
      name: i18n.t("workOrders.tabs.withCount", {
        label: i18n.t("workOrders.tabs.Open"),
        count: 2,
      }),
    })
    expect(openTab).toHaveAttribute("aria-selected", "true")
    expect(
      await screen.findAllByRole("link", {
        name: i18n.t("workOrders.actions.execute"),
      }),
    ).toHaveLength(2)
    expect(
      screen.queryByText(i18n.t("workOrders.empty.Open")),
    ).not.toBeInTheDocument()

    const inProgressTab = screen.getByRole("tab", {
      name: i18n.t("workOrders.tabs.withCount", {
        label: i18n.t("workOrders.tabs.InProgress"),
        count: 1,
      }),
    })
    await user.click(within(inProgressTab).getByText("1"))

    expect(inProgressTab).toHaveAttribute("aria-selected", "true")
    const execute = await screen.findByRole("link", {
      name: i18n.t("workOrders.actions.execute"),
    })
    expect(execute).toHaveAttribute("href", `/os/${inProgress.id}`)
    expect(
      screen.queryByText(i18n.t("workOrders.empty.Open")),
    ).not.toBeInTheDocument()
  })

  it("lists canceled work orders on the Canceladas tab", async () => {
    const user = userEvent.setup()
    const canceled = makeWorkOrder({ status: "Canceled" })
    getWorkOrdersMock.mockResolvedValue([canceled])

    renderList(["os.work_orders.read"], ["os"])

    await user.click(
      await screen.findByRole("tab", {
        name: new RegExp(i18n.t("workOrders.tabs.Canceled")),
      }),
    )

    const view = await screen.findByRole("link", {
      name: i18n.t("workOrders.actions.view"),
    })
    expect(view).toHaveAttribute("href", `/os/${canceled.id}`)
  })

  it("keeps the generic empty copy for someone who can see every work order", async () => {
    getWorkOrdersMock.mockResolvedValue([])

    renderList(["os.work_orders.read", "os.work_orders.create"], ["os"])

    expect(
      await screen.findByText(i18n.t("workOrders.empty.Open")),
    ).toBeInTheDocument()
  })

  it("tells an execute-only technician when nothing is assigned to them", async () => {
    getWorkOrdersMock.mockResolvedValue([])

    renderList(["os.work_orders.read", "os.work_orders.execute"], ["os"])

    expect(
      await screen.findByText(i18n.t("workOrders.emptyAssigned.Open")),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("workOrders.empty.Open")),
    ).not.toBeInTheDocument()
  })

  it("replaces a 403 or 404 load failure and hides the empty pending copy", async () => {
    getWorkOrdersMock.mockRejectedValue(
      new Error(i18n.t("workOrders.errors.notAssignedOrForbidden")),
    )

    renderList(["os.work_orders.read", "os.work_orders.execute"], ["os"])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("workOrders.errors.notAssignedOrForbidden"),
    )
    expect(
      screen.queryByText(i18n.t("workOrders.empty.Open")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("workOrders.emptyAssigned.Open")),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
  })
})
