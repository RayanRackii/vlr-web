import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { MandatoryTasksIncompleteError } from "@/features/workOrders/lib/workOrderApiErrors"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import {
  makeWorkOrder,
  sampleTechnician,
  TECHNICIAN_ID,
  WORK_ORDER_ID,
} from "@/features/workOrders/test/workOrderFixtures"
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
  uploadWorkOrderTaskFile: vi.fn(),
  getWorkOrderTaskFileUrl: vi.fn(async () => ({
    url: "https://files.example/photo?exp=9999999999",
    isPublic: false as const,
  })),
  updateWorkOrderAssignee: vi.fn(),
}))

vi.mock("@/features/users/services/usersService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/users/services/usersService")>()
  return {
    ...actual,
    getTechnicians: vi.fn(),
  }
})

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
  subscribeSyncQueue,
} from "@/lib/offlineSync"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  getWorkOrderById,
  updateTaskValue,
  updateWorkOrderAssignee,
  updateWorkOrderStatus,
} from "@/features/workOrders/services/workOrdersService"

beforeAll(() => {
  vi.spyOn(HTMLImageElement.prototype, "src", "set").mockImplementation(function (
    this: HTMLImageElement,
    value: string,
  ) {
    this.setAttribute("src", value)
  })
})

afterAll(() => {
  vi.restoreAllMocks()
})

const getWorkOrderByIdMock = vi.mocked(getWorkOrderById)
const getTechniciansMock = vi.mocked(getTechnicians)
const updateWorkOrderAssigneeMock = vi.mocked(updateWorkOrderAssignee)
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

  it("does not autosave a number below its minimum or complete the work order", async () => {
    const user = userEvent.setup()
    const order = makeWorkOrder({ status: "InProgress" })
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    order.tasks = [{
      ...task,
      inputType: "Number",
      configuration: JSON.stringify({ min: 0, unit: "A" }),
      value: null,
    }]
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateTaskValueMock.mockResolvedValue(order)
    updateWorkOrderStatusMock.mockResolvedValue({ ...order, status: "Completed" })

    renderExecution(["os.work_orders.read"], ["os"])

    const field = await screen.findByRole("spinbutton")
    const complete = screen.getByRole("button", {
      name: i18n.t("workOrders.execution.complete"),
    })
    fireEvent.change(field, { target: { value: "5" } })
    fireEvent.change(field, { target: { value: "-5" } })

    expect(field).toHaveValue(-5)
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent(
      i18n.t("workOrders.errors.taskValue.outOfRange"),
    )
    expect(complete).toBeDisabled()
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450))
    })
    await user.click(complete)
    expect(updateTaskValueMock).not.toHaveBeenCalled()
    expect(updateWorkOrderStatusMock).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: "0" } })
    expect(field).not.toHaveAttribute("aria-invalid", "true")
    expect(complete).toBeEnabled()
    await user.click(complete)

    await waitFor(() => {
      expect(updateTaskValueMock).toHaveBeenCalledWith(order.id, task.id, "0")
      expect(updateWorkOrderStatusMock).toHaveBeenCalledWith(order.id, "Completed")
    })
  })

  it.each([
    { min: 0, value: "0" },
    { min: 10, value: "15" },
    { min: -10, value: "-5" },
    { min: undefined, value: "-5" },
  ])("saves $value when the configured minimum is $min", async ({ min, value }) => {
    const user = userEvent.setup()
    const order = makeWorkOrder({ status: "InProgress" })
    const task = order.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    order.tasks = [{
      ...task,
      inputType: "Number",
      configuration: JSON.stringify({ min }),
      value: null,
    }]
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateTaskValueMock.mockResolvedValue(order)
    updateWorkOrderStatusMock.mockResolvedValue({ ...order, status: "Completed" })

    renderExecution(["os.work_orders.read"], ["os"])

    const field = await screen.findByRole("spinbutton")
    await user.type(field, value)
    expect(field).toHaveValue(Number(value))
    await user.click(screen.getByRole("button", {
      name: i18n.t("workOrders.execution.complete"),
    }))

    await waitFor(() => {
      expect(updateTaskValueMock).toHaveBeenCalledWith(order.id, task.id, value)
      expect(updateWorkOrderStatusMock).toHaveBeenCalledWith(order.id, "Completed")
    })
  })

  it("keeps completion disabled while a required photo is empty", async () => {
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

    renderExecution(["os.work_orders.read"], ["os"])

    expect(
      await screen.findByRole("button", {
        name: i18n.t("workOrders.execution.imageChoose"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("workOrders.execution.imageUnsupported")),
    ).not.toBeInTheDocument()
    const missing = screen.getByRole("list", {
      name: i18n.t("workOrders.execution.mandatoryIncompleteTitle"),
    })
    expect(within(missing).getByText("Foto")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    ).toBeDisabled()
    expect(updateWorkOrderStatusMock).not.toHaveBeenCalled()
    expect(updateTaskValueMock).not.toHaveBeenCalled()
  })

  it("completes a mandatory photo from the stored file id without patching it", async () => {
    const user = userEvent.setup()
    const base = makeWorkOrder()
    const task = base.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const imageOrder = makeWorkOrder({
      status: "InProgress",
      tasks: [
        {
          ...task,
          title: "Foto",
          inputType: "Image",
          isMandatory: true,
          value: "3f1c2a0e-4b9d-4f3a-9c7e-1d2a3b4c5d6e",
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
      await screen.findByRole("img", {
        name: i18n.t("workOrders.execution.imagePreviewAlt", { title: "Foto" }),
      }),
    ).toHaveAttribute("src", "https://files.example/photo?exp=9999999999")
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
    expect(updateTaskValueMock).not.toHaveBeenCalled()
  })

  it("blocks completion when a mandatory checkbox is false", async () => {
    const order = makeWorkOrder({
      tasks: [
        {
          ...(makeWorkOrder().tasks[0] as NonNullable<
            ReturnType<typeof makeWorkOrder>["tasks"][number]
          >),
          title: "Verificar filtros",
          inputType: "Checkbox",
          isMandatory: true,
          value: "false",
        },
      ],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)

    renderExecution(["os.work_orders.read"], ["os"])

    const missing = await screen.findByRole("list", {
      name: i18n.t("workOrders.execution.mandatoryIncompleteTitle"),
    })
    expect(within(missing).getByText("Verificar filtros")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    ).toHaveAttribute("aria-describedby", "work-order-missing-tasks")
    expect(updateWorkOrderStatusMock).not.toHaveBeenCalled()
  })

  it("shows the task list from MANDATORY_TASKS_INCOMPLETE", async () => {
    const user = userEvent.setup()
    const order = makeWorkOrder({
      tasks: [
        {
          ...(makeWorkOrder().tasks[0] as NonNullable<
            ReturnType<typeof makeWorkOrder>["tasks"][number]
          >),
          inputType: "Checkbox",
          isMandatory: true,
          value: "true",
        },
      ],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateWorkOrderStatusMock.mockRejectedValue(
      new MandatoryTasksIncompleteError(["Foto do filtro", "Pressão"]),
    )

    renderExecution(["os.work_orders.read"], ["os"])

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    )

    const missing = await screen.findByRole("list", {
      name: i18n.t("workOrders.execution.mandatoryIncompleteTitle"),
    })
    expect(within(missing).getByText("Foto do filtro")).toBeInTheDocument()
    expect(within(missing).getByText("Pressão")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      }),
    ).toBeEnabled()
    expect(updateWorkOrderStatusMock).toHaveBeenCalledWith(order.id, "Completed")
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

  it("keeps a server rejection for a locally filled task until completion is retried", async () => {
    const user = userEvent.setup()
    const task = makeWorkOrder().tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const order = makeWorkOrder({
      status: "InProgress",
      tasks: [{ ...task, title: "Pressão", inputType: "Number", value: "12" }],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateWorkOrderStatusMock
      .mockRejectedValueOnce(new MandatoryTasksIncompleteError(["Pressão"]))
      .mockResolvedValueOnce({ ...order, status: "Completed" })
    updateTaskValueMock.mockResolvedValue({
      ...order,
      tasks: order.tasks.map((item) => ({ ...item, value: "13" })),
    })
    renderExecution(["os.work_orders.read"], ["os"])

    const complete = await screen.findByRole("button", {
      name: i18n.t("workOrders.execution.complete"),
    })
    await user.click(complete)
    const missing = await screen.findByRole("list", {
      name: i18n.t("workOrders.execution.mandatoryIncompleteTitle"),
    })
    expect(within(missing).getByText("Pressão")).toBeInTheDocument()
    expect(complete).toBeEnabled()

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "13" } })
    await screen.findByText(i18n.t("workOrders.execution.save.saved"))
    expect(within(missing).getByText("Pressão")).toBeInTheDocument()

    await user.click(complete)
    expect(updateWorkOrderStatusMock).toHaveBeenCalledTimes(2)
    expect(await screen.findByText(
      i18n.t("workOrders.execution.completedSuccess"),
    )).toBeInTheDocument()
    expect(screen.queryByRole("list", {
      name: i18n.t("workOrders.execution.mandatoryIncompleteTitle"),
    })).not.toBeInTheDocument()
  })

  it.each([
    ["Text", "A", "AB", "persisted"],
    ["Number", "1", "12", "persisted"],
    ["Text", "A", "AB", "queued"],
  ] as const)("keeps %s saving during the next debounce after an older %s/%s edit is %s", async (inputType, firstValue, nextValue, outcome) => {
    const task = makeWorkOrder().tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const order = makeWorkOrder({
      tasks: [{ ...task, inputType, isMandatory: false, value: null }],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    let resolveFirst: (value: typeof order | null) => void = () => undefined
    let resolveNext: (value: typeof order) => void = () => undefined
    updateTaskValueMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveNext = resolve
      }))
    renderExecution(["os.work_orders.read"], ["os"])

    const field = await screen.findByRole(inputType === "Text" ? "textbox" : "spinbutton")
    fireEvent.change(field, { target: { value: firstValue } })
    await waitFor(() => expect(updateTaskValueMock).toHaveBeenCalledTimes(1))
    fireEvent.change(field, { target: { value: nextValue } })
    await act(async () => {
      resolveFirst(outcome === "queued" ? null : {
        ...order,
        tasks: order.tasks.map((item) => ({ ...item, value: firstValue })),
      })
    })

    if (outcome === "queued") {
      const refreshQueue = vi.mocked(subscribeSyncQueue).mock.calls.at(-1)?.[0]
      if (!refreshQueue) {
        throw new Error("missing sync subscriber")
      }
      await act(async () => { refreshQueue() })
    }

    expect(field).toHaveValue(inputType === "Text" ? nextValue : Number(nextValue))
    expect(screen.queryByText(i18n.t("workOrders.execution.save.saved"))).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t("workOrders.execution.save.saving"))).toBeInTheDocument()
    await waitFor(() => expect(updateTaskValueMock).toHaveBeenCalledTimes(2))
    expect(updateTaskValueMock).toHaveBeenLastCalledWith(order.id, task.id, nextValue)
    await act(async () => {
      resolveNext({
        ...order,
        tasks: order.tasks.map((item) => ({ ...item, value: nextValue })),
      })
    })
    expect(screen.getByText(i18n.t("workOrders.execution.save.saved"))).toBeInTheDocument()
  })

  it("bounds a long mandatory list and keeps the actions outside its keyboard-scrollable area", async () => {
    const task = makeWorkOrder().tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    getWorkOrderByIdMock.mockResolvedValue(makeWorkOrder({
      tasks: Array.from({ length: 80 }, (_, index) => ({
        ...task,
        id: `task-${index}`,
        title: `Tarefa ${index + 1}`,
        order: index + 1,
      })),
    }))
    renderExecution(["os.work_orders.read"], ["os"])

    const missing = await screen.findByRole("list", {
      name: i18n.t("workOrders.execution.mandatoryIncompleteTitle"),
    })
    expect(within(missing).getAllByRole("listitem")).toHaveLength(80)
    expect(within(missing).getByText("Tarefa 80")).toBeInTheDocument()
    expect(document.querySelector("[data-work-order-action-bar]")).toHaveClass("max-h-[50dvh]")
    expect(missing).toHaveClass("overflow-y-auto", "min-h-0")
    expect(missing).toHaveAttribute("tabindex", "0")
    expect(missing).not.toContainElement(screen.getByRole("button", {
      name: i18n.t("workOrders.execution.complete"),
    }))
  })

  it("announces a started work order in the existing status region", async () => {
    const user = userEvent.setup()
    const order = makeWorkOrder({
      tasks: [
        {
          ...(makeWorkOrder().tasks[0] as NonNullable<
            ReturnType<typeof makeWorkOrder>["tasks"][number]
          >),
          isMandatory: false,
        },
      ],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateWorkOrderStatusMock.mockResolvedValue({
      ...order,
      status: "InProgress",
    })

    renderExecution(["os.work_orders.read"], ["os"])

    const announcement = await screen.findByTestId(
      "work-order-status-announcement",
    )
    expect(announcement).toHaveAttribute("aria-live", "polite")
    expect(announcement).toHaveTextContent("")

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("workOrders.execution.start"),
      }),
    )

    expect(announcement).toHaveTextContent(
      i18n.t("workOrders.execution.startedSuccess"),
    )
    expect(announcement.className).not.toContain("sr-only")
  })

  it("shows saving and then saved on a task", async () => {
    const user = userEvent.setup()
    const base = makeWorkOrder()
    const task = base.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const order = makeWorkOrder({
      tasks: [
        {
          ...task,
          inputType: "Text",
          isMandatory: false,
          value: null,
        },
      ],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    let resolveSave: (value: ReturnType<typeof makeWorkOrder>) => void = () =>
      undefined
    updateTaskValueMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        }),
    )

    renderExecution(["os.work_orders.read"], ["os"])

    await user.type(
      await screen.findByPlaceholderText(
        i18n.t("workOrders.execution.textPlaceholder"),
      ),
      "a",
    )

    expect(
      await screen.findByText(i18n.t("workOrders.execution.save.saving")),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(updateTaskValueMock).toHaveBeenCalled()
    })
    resolveSave(
      makeWorkOrder({
        ...order,
        tasks: order.tasks.map((item) => ({ ...item, value: "a" })),
      }),
    )
    expect(
      await screen.findByText(i18n.t("workOrders.execution.save.saved")),
    ).toBeInTheDocument()
  })

  it("does not show saved when the response confirms a different value from the displayed draft", async () => {
    const base = makeWorkOrder()
    const task = base.tasks[0]
    if (!task) {
      throw new Error("missing task")
    }
    const order = makeWorkOrder({
      tasks: [{ ...task, inputType: "Text", isMandatory: false, value: "A" }],
    })
    getWorkOrderByIdMock.mockResolvedValue(order)
    updateTaskValueMock.mockResolvedValue(order)
    renderExecution(["os.work_orders.read"], ["os"])
    const field = await screen.findByRole("textbox")
    fireEvent.change(field, { target: { value: "B" } })
    await waitFor(() => {
      expect(updateTaskValueMock).toHaveBeenCalledWith(order.id, task.id, "B")
    })
    await act(async () => undefined)

    expect(field).toHaveValue("B")
    expect(screen.queryByText(i18n.t("workOrders.execution.save.saved"))).not.toBeInTheDocument()
  })

  it("shows a retry label when the task answer is queued", async () => {
    const user = userEvent.setup()
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
            inputType: "Text",
            isMandatory: false,
            value: null,
          },
        ],
      }),
    )
    updateTaskValueMock.mockResolvedValue(null)

    renderExecution(["os.work_orders.read"], ["os"])

    await user.type(
      await screen.findByPlaceholderText(
        i18n.t("workOrders.execution.textPlaceholder"),
      ),
      "a",
    )

    expect(
      await screen.findByText(i18n.t("workOrders.execution.save.retrying")),
    ).toBeInTheDocument()
  })

  it("pads the page by the measured action bar height", async () => {
    const original = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.getAttribute("data-work-order-action-bar") != null) {
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 88,
          top: 0,
          right: 0,
          bottom: 88,
          left: 0,
          toJSON() {
            return {}
          },
        }
      }

      return original.call(this)
    }

    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({
        tasks: [
          {
            ...(makeWorkOrder().tasks[0] as NonNullable<
              ReturnType<typeof makeWorkOrder>["tasks"][number]
            >),
            isMandatory: false,
          },
        ],
      }),
    )

    try {
      renderExecution(["os.work_orders.read"], ["os"])
      await screen.findByRole("button", {
        name: i18n.t("workOrders.execution.complete"),
      })
      await waitFor(() => {
        expect(
          document.querySelector("[data-work-order-execution]"),
        ).toHaveStyle({ paddingBottom: "88px" })
      })
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original
    }
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

    expect(
      await screen.findByRole("heading", { name: /Verificar filtros/ }),
    ).toBeInTheDocument()
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
        clientSequence: 0,
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
        clientSequence: 0,
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
        clientSequence: 0,
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

describe("WorkOrderExecutionPage assignee", () => {
  beforeEach(() => {
    getWorkOrderByIdMock.mockReset()
    getTechniciansMock.mockReset()
    updateWorkOrderAssigneeMock.mockReset()
    listSyncConflictsMock.mockReset()
    listSyncConflictsMock.mockResolvedValue([])
    getTechniciansMock.mockResolvedValue([sampleTechnician])
  })

  it("shows the assignee name without a selector when the user cannot assign", async () => {
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({
        assignedUserId: TECHNICIAN_ID,
        assignedUser: sampleTechnician,
      }),
    )

    renderExecution(["os.work_orders.read", "os.work_orders.execute"], ["os"])

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", {
        name: i18n.t("workOrders.columns.assignee"),
      }),
    ).not.toBeInTheDocument()
    expect(getTechniciansMock).not.toHaveBeenCalled()
  })

  it("reassigns an open work order through the assignee endpoint", async () => {
    const user = userEvent.setup()
    getWorkOrderByIdMock.mockResolvedValue(makeWorkOrder())
    updateWorkOrderAssigneeMock.mockResolvedValue(
      makeWorkOrder({
        assignedUserId: TECHNICIAN_ID,
        assignedUser: sampleTechnician,
      }),
    )

    renderExecution(
      ["os.work_orders.read", "os.work_orders.assign"],
      ["os"],
    )

    await user.click(
      await screen.findByRole("combobox", {
        name: i18n.t("workOrders.columns.assignee"),
      }),
    )
    await user.click(
      await screen.findByRole("option", { name: sampleTechnician.fullName }),
    )

    await waitFor(() => {
      expect(updateWorkOrderAssigneeMock).toHaveBeenCalledWith(
        WORK_ORDER_ID,
        TECHNICIAN_ID,
      )
    })
    expect(screen.getByRole("combobox", {
      name: i18n.t("workOrders.columns.assignee"),
    })).toHaveTextContent(sampleTechnician.fullName)
  })

  it("keeps the current assignee when the technician list is forbidden", async () => {
    getWorkOrderByIdMock.mockResolvedValue(
      makeWorkOrder({
        assignedUserId: TECHNICIAN_ID,
        assignedUser: sampleTechnician,
      }),
    )
    getTechniciansMock.mockRejectedValue(new Error("FORBIDDEN"))

    renderExecution(
      ["os.work_orders.read", "os.work_orders.assign"],
      ["os"],
    )

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    expect(
      await screen.findByText(i18n.t("rbac.errors.FORBIDDEN")),
    ).toBeInTheDocument()
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", {
        name: i18n.t("workOrders.columns.assignee"),
      }),
    ).not.toBeInTheDocument()
  })

  it("explains a 404 when the work order is not assigned to the caller", async () => {
    getWorkOrderByIdMock.mockRejectedValue(
      new Error(i18n.t("workOrders.errors.notAssignedOrForbidden")),
    )

    renderExecution(["os.work_orders.read", "os.work_orders.execute"], ["os"])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("workOrders.errors.notAssignedOrForbidden"),
    )
    expect(
      screen.queryByText(i18n.t("workOrders.errors.loadOneFailed")),
    ).not.toBeInTheDocument()
  })
})
