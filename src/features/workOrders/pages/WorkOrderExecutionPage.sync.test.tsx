import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import {
  makeWorkOrder,
  WORK_ORDER_ID,
} from "@/features/workOrders/test/workOrderFixtures"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { noteTransportFailure, resetConnectivityForTests } from "@/lib/connectivity"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const store = new Map<string, unknown>()
const authSession = vi.hoisted(() => ({ access_token: "test" }))
const TASK_ID = "16161616-1616-4161-8161-161616161616"

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value)
  }),
  setMany: vi.fn(async (entries: ReadonlyArray<readonly [string, unknown]>) => {
    for (const [key, value] of entries) {
      store.set(key, value)
    }
  }),
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  }
})

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import { api } from "@/lib/api"
import { enqueueTaskValuePatch } from "@/lib/offlineSync"

const apiGet = vi.mocked(api.get)
const apiPatch = vi.mocked(api.patch)

function axiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError("Request failed")
  error.response = {
    status,
    data,
    statusText: "Error",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  } as AxiosResponse
  return error
}

function networkError(): AxiosError {
  return new AxiosError("Network Error", "ERR_NETWORK")
}

function textOrder(value: string | null): WorkOrder {
  const base = makeWorkOrder()
  const task = base.tasks[0]
  if (!task) {
    throw new Error("missing task")
  }

  return makeWorkOrder({
    tasks: [
      {
        ...task,
        inputType: "Text",
        title: "Leitura",
        value,
      },
    ],
  })
}

function renderExecution() {
  return render(
    <MemoryRouter initialEntries={[`/os/${WORK_ORDER_ID}`]}>
      <TestPermissionProvider permissions={["os.work_orders.read"]} activeModules={["os"]}>
        <Routes>
          <Route path="/os/:id" element={<WorkOrderExecutionPage />} />
          <Route path="/os" element={<div>os-list</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("WorkOrderExecutionPage offline sync", () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    store.clear()
    apiGet.mockReset()
    apiPatch.mockReset()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    resetConnectivityForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetConnectivityForTests()
  })

  it.each([false, true])("clears offline immediately on reconnect with queued edits=%s, before the detail reload", async (queued) => {
    apiGet.mockResolvedValueOnce({ data: textOrder(null), status: 200 })
    // The UI must not wait for this slow background GET to clear its banners.
    let releaseReload: () => void = () => undefined
    const reload = new Promise<void>((resolve) => { releaseReload = resolve })
    apiGet.mockImplementation(async () => {
      await reload
      return { data: textOrder("offline value"), status: 200 }
    })
    apiPatch.mockResolvedValue({ data: textOrder("offline value"), status: 200 })
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    resetConnectivityForTests()
    if (queued) {
      await enqueueTaskValuePatch({ workOrderId: WORK_ORDER_ID, taskId: TASK_ID, value: "offline value" })
    }
    renderExecution()
    await screen.findByRole("textbox")
    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
    if (queued) await screen.findByText(i18n.t("workOrders.execution.save.retrying"))
    expect(toast.success).not.toHaveBeenCalled()

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    await act(async () => { window.dispatchEvent(new Event("online")) })

    expect(screen.queryByText(i18n.t("workOrders.offline.title"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.execution.save.retrying"))).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(i18n.t("workOrders.offline.synced"), { duration: 3000 })
    expect(apiGet).toHaveBeenCalledTimes(2)
    await act(async () => { releaseReload() })
  })

  it.each([0, 503, 409])("does not announce sync when a queued edit fails with status %s", async (status) => {
    apiGet.mockResolvedValue({ data: textOrder(null), status: 200 })
    apiPatch.mockRejectedValue(status === 0 ? networkError() : axiosError(status, { error: "Rejected" }))
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    resetConnectivityForTests()
    await enqueueTaskValuePatch({ workOrderId: WORK_ORDER_ID, taskId: TASK_ID, value: "offline value" })
    renderExecution()
    await screen.findByRole("textbox")
    await screen.findByText(i18n.t("workOrders.execution.save.retrying"))

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    await act(async () => { window.dispatchEvent(new Event("online")) })

    expect(toast.success).not.toHaveBeenCalled()
    if (status === 409) {
      expect(screen.getByText(i18n.t("workOrders.offline.conflictTitle"))).toBeInTheDocument()
    } else {
      expect(screen.getByText(i18n.t("workOrders.execution.save.retrying"))).toBeInTheDocument()
    }
  })

  it("announces recovery from a transport failure with no queued edits", async () => {
    apiGet.mockResolvedValue({ data: textOrder(null), status: 200 })
    renderExecution()
    await screen.findByRole("textbox")
    expect(toast.success).not.toHaveBeenCalled()
    act(() => { noteTransportFailure() })
    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
    await act(async () => { window.dispatchEvent(new Event("online")) })
    expect(screen.queryByText(i18n.t("workOrders.offline.title"))).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(i18n.t("workOrders.offline.synced"), { duration: 3000 })
  })

  it("shows discard and the saved value when sync returns 409 and reload fails", async () => {
    await enqueueTaskValuePatch({
      workOrderId: WORK_ORDER_ID,
      taskId: TASK_ID,
      value: "leitura offline",
    })
    apiGet.mockRejectedValue(networkError())
    apiPatch.mockRejectedValue(
      axiosError(409, {
        error: "Work order is completed or canceled and cannot be changed.",
        code: "WORK_ORDER_CLOSED",
      }),
    )

    renderExecution()

    expect(
      await screen.findByText(i18n.t("workOrders.errors.loadOneFailed")),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", {
        name: i18n.t("workOrders.offline.discardNamed", {
          field: i18n.t("workOrders.offline.conflictUnknownField"),
        }),
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: i18n.t("workOrders.offline.retryNamed", {
          field: i18n.t("workOrders.offline.conflictUnknownField"),
        }),
      }),
    ).toBeEnabled()
    expect(
      screen.getByText(
        i18n.t("workOrders.offline.conflictValue", {
          value: "leitura offline",
        }),
      ),
    ).toBeInTheDocument()
  })

  it("clears the waiting label after sync and keeps the typed text", async () => {
    const user = userEvent.setup()
    let storedOrder = textOrder(null)
    apiGet.mockImplementation(async () => ({ data: storedOrder, status: 200 }))
    apiPatch.mockImplementation(async () => {
      storedOrder = textOrder("leitura")
      return { data: storedOrder, status: 200 }
    })

    renderExecution()

    const field = await screen.findByRole("textbox")
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    window.dispatchEvent(new Event("offline"))
    await user.type(field, "leitura")

    expect(
      await screen.findByText(i18n.t("workOrders.execution.save.retrying")),
    ).toBeInTheDocument()

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    window.dispatchEvent(new Event("online"))

    await waitFor(() => {
      expect(
        screen.queryByText(i18n.t("workOrders.execution.save.retrying")),
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByText(i18n.t("workOrders.execution.save.saved")),
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveValue("leitura")
    expect(apiPatch).toHaveBeenCalledWith(
      `/api/work-orders/${WORK_ORDER_ID}/tasks/${TASK_ID}`,
      { value: "leitura" },
    )
  })

  it("does not label A as saved after reloading with B queued and syncing B to the server", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    await enqueueTaskValuePatch({
      workOrderId: WORK_ORDER_ID,
      taskId: TASK_ID,
      value: "B",
    })
    let storedOrder = textOrder("A")
    let releaseRefresh: () => void = () => undefined
    const refreshReady = new Promise<void>((resolve) => { releaseRefresh = resolve })
    apiGet
      .mockResolvedValueOnce({ data: storedOrder, status: 200 })
      .mockImplementation(async () => {
        await refreshReady
        return { data: storedOrder, status: 200 }
      })
    apiPatch.mockImplementation(async () => {
      storedOrder = textOrder("B")
      return { data: storedOrder, status: 200 }
    })
    renderExecution()
    const field = await screen.findByRole("textbox")
    expect(field).toHaveValue("A")
    await screen.findByText(i18n.t("workOrders.execution.save.retrying"))

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    await act(async () => { window.dispatchEvent(new Event("online")) })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
    expect(store.get("os_sync_queue")).toEqual([])
    expect(field).toHaveValue("A")
    expect(screen.queryByText(i18n.t("workOrders.execution.save.saved"))).not.toBeInTheDocument()
    await act(async () => { releaseRefresh() })

    expect(apiPatch).toHaveBeenCalledWith(
      `/api/work-orders/${WORK_ORDER_ID}/tasks/${TASK_ID}`,
      { value: "B" },
    )
    expect(storedOrder.tasks[0]?.value).toBe("B")
    expect(field).toHaveValue("A")
    expect(screen.queryByText(i18n.t("workOrders.execution.save.saved"))).not.toBeInTheDocument()
  })
})
