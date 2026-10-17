import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { makeWorkOrder, WORK_ORDER_ID } from "@/features/workOrders/test/workOrderFixtures"
import { PLAN_ID } from "@/features/pmoc/test/pmocFixtures"
import i18n from "@/lib/i18n"

const authSession = vi.hoisted(() => ({ access_token: "test" }))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/lib/offlineSync", () => ({
  processSyncQueue: vi.fn(async () => ({
    processed: 0,
    remaining: 0,
    conflicts: [],
  })),
  enqueueTaskValuePatch: vi.fn(),
  isNetworkConnectivityError: () => false,
  listQueuedTaskIds: vi.fn(async () => []),
  listSyncConflicts: vi.fn(async () => []),
  subscribeSyncQueue: vi.fn(() => () => undefined),
  clearSyncConflict: vi.fn(),
  retrySyncConflict: vi.fn(async () => ({
    processed: 0,
    remaining: 0,
    conflicts: [],
  })),
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
import {
  clearSyncConflict,
  listSyncConflicts,
  retrySyncConflict,
} from "@/lib/offlineSync"
import {
  getWorkOrderById,
  updateTaskValue,
  updateWorkOrderStatus,
} from "@/features/workOrders/services/workOrdersService"

const getWorkOrderByIdMock = vi.mocked(getWorkOrderById)
const getPlanMock = vi.mocked(getPlan)
const updateTaskValueMock = vi.mocked(updateTaskValue)
const updateWorkOrderStatusMock = vi.mocked(updateWorkOrderStatus)
const listSyncConflictsMock = vi.mocked(listSyncConflicts)
const clearSyncConflictMock = vi.mocked(clearSyncConflict)
const retrySyncConflictMock = vi.mocked(retrySyncConflict)

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

describe("WorkOrderExecutionPage tasks", () => {
  beforeEach(() => {
    getWorkOrderByIdMock.mockReset()
    updateTaskValueMock.mockReset()
    updateWorkOrderStatusMock.mockReset()
    listSyncConflictsMock.mockReset()
    listSyncConflictsMock.mockResolvedValue([])
    clearSyncConflictMock.mockReset()
    retrySyncConflictMock.mockReset()
    retrySyncConflictMock.mockResolvedValue({
      processed: 0,
      remaining: 0,
      conflicts: [],
    })
  })

  it("opens single-choice options in a native select", async () => {
    const base = makeWorkOrder()
    const task = base.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({
        tasks: [
          {
            ...task,
            title: "Estado",
            inputType: "SingleChoice",
            configuration: JSON.stringify({ options: ["Ok", "Trocar"] }),
          },
        ],
      }),
    )

    renderExecution(["os.work_orders.read"], ["os"])

    const select = await screen.findByRole("combobox", { name: "Estado" })
    expect(select).toBeInstanceOf(HTMLSelectElement)
    expect(screen.getByRole("option", { name: "Ok" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Trocar" })).toBeInTheDocument()
  })

  it("does not block completion on an image task", async () => {
    const user = userEvent.setup()
    const base = makeWorkOrder()
    const task = base.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const imageOrder = makeWorkOrder({
      tasks: [
        {
          ...task,
          title: "Foto",
          inputType: "Image",
          isMandatory: true,
          value: null,
        },
      ],
    })
    getWorkOrderByIdMock.mockResolvedValue(imageOrder)
    updateWorkOrderStatusMock.mockResolvedValue({
      ...imageOrder,
      status: "Completed",
    })

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByText(i18n.t("workOrders.execution.imageUnsupported")),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    )
    await waitFor(() => {
      expect(updateWorkOrderStatusMock).toHaveBeenCalledWith(
        imageOrder.id,
        "Completed",
      )
    })
  })

  it("flushes a pending text edit before completing", async () => {
    const user = userEvent.setup()
    const order = makeWorkOrder({
      status: "InProgress",
      tasks: [
        {
          ...(makeWorkOrder().tasks[0] as NonNullable<
            ReturnType<typeof makeWorkOrder>["tasks"][number]
          >),
          inputType: "Text",
          value: null,
        },
      ],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateTaskValueMock.mockImplementation(async (_workOrderId, _taskId, value) =>
      makeWorkOrder({
        ...order,
        tasks: order.tasks.map((task) => ({ ...task, value: value ?? null })),
      }),
    )
    updateWorkOrderStatusMock.mockResolvedValue({
      ...order,
      status: "Completed",
    })

    renderExecution(["os.work_orders.read"], ["os"])

    const field = await screen.findByPlaceholderText(
      i18n.t("workOrders.execution.textPlaceholder"),
    )
    await user.type(field, "ok")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    )

    await waitFor(() => {
      expect(updateTaskValueMock).toHaveBeenCalledWith(
        order.id,
        order.tasks[0]?.id,
        "ok",
      )
      expect(updateWorkOrderStatusMock).toHaveBeenCalledWith(
        order.id,
        "Completed",
      )
    })
    const taskOrder = updateTaskValueMock.mock.invocationCallOrder[0] ?? 0
    const statusOrder = updateWorkOrderStatusMock.mock.invocationCallOrder[0] ?? 0
    expect(taskOrder).toBeLessThan(statusOrder)
  })

  it("shows notes and the completed date", async () => {
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({
        notes: "Levar peça",
        completedDate: "2026-09-19T15:04:00.000Z",
        status: "Completed",
      }),
    )

    renderExecution(["os.work_orders.read"], ["os"])

    expect(await screen.findByText("Levar peça")).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("workOrders.execution.completedDate")),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("workOrders.execution.notCompleted")),
    ).not.toBeInTheDocument()
  })

  it("clears a failed load after reconnect", async () => {
    getWorkOrderByIdMock.mockRejectedValueOnce(
      new Error(i18n.t("workOrders.errors.loadOneFailed")),
    )
    getWorkOrderByIdMock.mockResolvedValue(makeWorkOrder())

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByText(i18n.t("workOrders.errors.loadOneFailed")),
    ).toBeInTheDocument()

    window.dispatchEvent(new Event("online"))

    expect(await screen.findByText(/Verificar filtros/)).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("workOrders.errors.loadOneFailed")),
    ).not.toBeInTheDocument()
  })

  it("shows a sync conflict instead of dropping it", async () => {
    const order = makeWorkOrder()
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    listSyncConflictsMock.mockResolvedValue([
      {
        id: `${order.id}:${task.id}`,
        workOrderId: order.id,
        taskId: task.id,
        value: "x",
        queuedAt: "2026-10-17T00:00:00.000Z",
        status: 409,
        message: "conflict",
        code: null,
        reason: null,
      },
    ])
    getWorkOrderByIdMock.mockResolvedValue(order)

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByText(i18n.t("workOrders.offline.conflictTitle")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("workOrders.offline.conflictField", {
          field: task.title,
          reason: "conflict",
        }),
      ),
    ).toBeInTheDocument()
  })

  it("discards and retries a closed work order conflict", async () => {
    const user = userEvent.setup()
    const order = makeWorkOrder()
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    listSyncConflictsMock.mockResolvedValue([
      {
        id: `${order.id}:${task.id}`,
        workOrderId: order.id,
        taskId: task.id,
        value: "true",
        queuedAt: "2026-10-17T00:00:00.000Z",
        status: 409,
        message: "Work order is completed or canceled and cannot be changed.",
        code: "WORK_ORDER_CLOSED",
        reason: null,
      },
    ])
    getWorkOrderByIdMock.mockResolvedValue(order)
    clearSyncConflictMock.mockImplementation(async () => {
      listSyncConflictsMock.mockResolvedValue([])
    })

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByText(
        i18n.t("workOrders.offline.conflictField", {
          field: task.title,
          reason: i18n.t("workOrders.errors.workOrderClosed"),
        }),
      ),
    ).toBeInTheDocument()

    const discard = screen.getByRole("button", {
      name: i18n.t("workOrders.offline.discardNamed", { field: task.title }),
    })
    expect(discard).toBeEnabled()
    await user.click(discard)

    await waitFor(() => {
      expect(clearSyncConflictMock).toHaveBeenCalledWith(order.id, task.id)
      expect(
        screen.queryByText(i18n.t("workOrders.offline.conflictTitle")),
      ).not.toBeInTheDocument()
    })

    listSyncConflictsMock.mockResolvedValue([
      {
        id: `${order.id}:${task.id}`,
        workOrderId: order.id,
        taskId: task.id,
        value: "true",
        queuedAt: "2026-10-17T00:00:00.000Z",
        status: 409,
        message: "Work order is completed or canceled and cannot be changed.",
        code: "WORK_ORDER_CLOSED",
        reason: null,
      },
    ])
    window.dispatchEvent(new Event("online"))
    expect(
      await screen.findByRole("button", {
        name: i18n.t("workOrders.offline.retryNamed", { field: task.title }),
      }),
    ).toBeEnabled()
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("workOrders.offline.retryNamed", { field: task.title }),
      }),
    )
    await waitFor(() => {
      expect(retrySyncConflictMock).toHaveBeenCalledWith(order.id, task.id)
    })
  })
})
