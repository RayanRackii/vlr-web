import { AxiosError, CanceledError } from "axios"
import { act, fireEvent, render, screen } from "@testing-library/react"
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
import { resetConnectivityForTests } from "@/lib/connectivity"
import i18n from "@/lib/i18n"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const store = new Map<string, unknown>()
const authSession = vi.hoisted(() => ({ current: { access_token: "test" } }))

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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession.current }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

import { api } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { WorkOrderSyncHost } from "@/features/workOrders/components/WorkOrderSyncHost"

const originalAdapter = api.defaults.adapter

function textOrder(value: string | null): WorkOrder {
  const base = makeWorkOrder()
  return makeWorkOrder({ tasks: [{ ...base.tasks[0]!, inputType: "Text", title: "Leitura", value }] })
}

async function settle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
}

function connection(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online)
  act(() => { window.dispatchEvent(new Event(online ? "online" : "offline")) })
}

describe("execution reconnect with the real Axios interceptors and global sync host", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    store.clear()
    vi.mocked(toast.success).mockClear()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    resetConnectivityForTests()
  })

  afterEach(async () => {
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    api.defaults.adapter = originalAdapter
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetConnectivityForTests()
  })

  it.each(["immediate", "transport recovers late", "PATCH recovers late", "GET recovers late"])("recovers without reload when %s, retaining the offline detail and draft", async (scenario) => {
    let saved: string | null = null
    let readyAt = 0
    let offlineGets = 0
    let failedPatches = 0
    let failedGets = 0
    let detailReads = 0
    let started = false
    api.defaults.adapter = async (config) => {
      const detail = config.method === "get" && config.url === `/api/work-orders/${WORK_ORDER_ID}`
      if (detail) detailReads += 1
      const recovering = Date.now() < readyAt && (
        scenario === "transport recovers late" ||
        (scenario === "PATCH recovers late" && config.method === "patch") ||
        (scenario === "GET recovers late" && detail)
      )
      if (!navigator.onLine || recovering) {
        if (detail) {
          failedGets += 1
          if (!navigator.onLine) offlineGets += 1
        }
        if (config.method === "patch") failedPatches += 1
        throw new AxiosError("Network Error", "ERR_NETWORK", config)
      }
      if (config.method === "patch") {
        if (config.url?.endsWith("/status")) started = true
        else saved = (JSON.parse(config.data as string) as { value: string }).value
      }
      return { data: { ...textOrder(saved), status: started ? "InProgress" : "Pending" }, status: 200, statusText: "OK", headers: {}, config }
    }
    const tree = () => (
      <MemoryRouter initialEntries={[`/os/${WORK_ORDER_ID}`]}>
        <WorkOrderSyncHost />
        <TestPermissionProvider permissions={["os.work_orders.read"]} activeModules={["os"]}>
          <Routes><Route path="/os/:id" element={<WorkOrderExecutionPage />} /></Routes>
        </TestPermissionProvider>
      </MemoryRouter>
    )
    const view = render(tree())
    await settle()
    fireEvent.click(screen.getByRole("button", { name: i18n.t("workOrders.execution.start") }))
    await settle()
    expect(started).toBe(true)
    connection(false)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nota sem reload" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    // A refreshed auth session can rerun the page's GET while DevTools is offline.
    authSession.current = { access_token: "refreshed" }
    view.rerender(tree())
    await settle()
    expect(offlineGets).toBeGreaterThan(0)
    expect(screen.getByRole("textbox")).toHaveValue("nota sem reload")
    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("workOrders.execution.save.retrying"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.errors.loadOneFailed"))).not.toBeInTheDocument()

    readyAt = Date.now() + (scenario === "immediate" ? 0 : 1500)
    const readsBeforeOnline = detailReads
    connection(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(saved).toBe("nota sem reload")
    expect(detailReads).toBeGreaterThan(readsBeforeOnline)
    if (scenario === "transport recovers late" || scenario === "PATCH recovers late") expect(failedPatches).toBeGreaterThan(0)
    if (scenario === "transport recovers late" || scenario === "GET recovers late") expect(failedGets).toBeGreaterThan(1)
    expect(screen.getByRole("textbox")).toHaveValue("nota sem reload")
    expect(store.get("os_sync_queue")).toEqual([])
    expect(screen.getByText(i18n.t("workOrders.execution.save.saved"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.offline.title"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.execution.save.retrying"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.errors.loadOneFailed"))).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(i18n.t("workOrders.offline.synced"), { duration: 3000 })
    connection(true)
    await settle()
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it("loads after online when the initial GET failed offline, without a false load error or sync toast", async () => {
    connection(false)
    api.defaults.adapter = async (config) => {
      if (!navigator.onLine) throw new AxiosError("Network Error", "ERR_NETWORK", config)
      return { data: textOrder(null), status: 200, statusText: "OK", headers: {}, config }
    }
    render(
      <MemoryRouter initialEntries={[`/os/${WORK_ORDER_ID}`]}>
        <WorkOrderSyncHost />
        <TestPermissionProvider permissions={["os.work_orders.read"]} activeModules={["os"]}>
          <Routes><Route path="/os/:id" element={<WorkOrderExecutionPage />} /></Routes>
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    await settle()
    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.errors.loadOneFailed"))).not.toBeInTheDocument()
    connection(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.offline.title"))).not.toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(["offline edit", "pending PATCH", "network failure", "timeout", "pending auth"])("clears the banner and announces exactly once after %s reconnects", async (scenario) => {
    let saved: string | null = null
    let holdPatch = scenario !== "offline edit" && scenario !== "pending auth"
    let patchStarted = false
    let detailReads = 0
    let releaseReload = () => undefined as void
    const reloadGate = new Promise<void>((resolve) => { releaseReload = resolve })
    api.defaults.adapter = async (config) => {
      if (config.method === "patch") {
        patchStarted = true
        if (holdPatch) {
          holdPatch = false
          await new Promise<void>((_resolve, reject) => {
            const timer = setTimeout(() => reject(new AxiosError("Network Error", "ERR_NETWORK", config)), scenario === "network failure" ? 50 : 30_000)
            config.signal?.addEventListener?.("abort", () => {
              clearTimeout(timer)
              reject(new CanceledError("offline", config))
            }, { once: true })
          })
        }
        saved = (JSON.parse(config.data as string) as { value: string }).value
      }
      if (config.method === "get" && config.url === `/api/work-orders/${WORK_ORDER_ID}` && ++detailReads > 1) {
        await reloadGate
      }
      return { data: textOrder(saved), status: 200, statusText: "OK", headers: {}, config }
    }
    render(
      <MemoryRouter initialEntries={[`/os/${WORK_ORDER_ID}`]}>
        <WorkOrderSyncHost />
        <TestPermissionProvider permissions={["os.work_orders.read"]} activeModules={["os"]}>
          <Routes><Route path="/os/:id" element={<WorkOrderExecutionPage />} /></Routes>
        </TestPermissionProvider>
      </MemoryRouter>,
    )
    await settle()
    const field = screen.getByRole("textbox")
    let releaseSession = () => undefined as void
    if (scenario === "pending auth") {
      vi.mocked(supabase.auth.getSession).mockImplementationOnce(() => new Promise((resolve) => {
        releaseSession = () => resolve({ data: { session: null }, error: null })
      }))
    }
    if (scenario === "offline edit") connection(false)
    fireEvent.change(field, { target: { value: "nota offline" } })
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    if (scenario !== "offline edit") {
      expect(patchStarted).toBe(scenario !== "pending auth")
      if (scenario === "network failure" || scenario === "timeout") {
        await act(async () => { await vi.advanceTimersByTimeAsync(scenario === "timeout" ? 10_000 : 50) })
        expect(toast.success).not.toHaveBeenCalled()
        expect(store.get("os_sync_queue")).toEqual([expect.objectContaining({ value: "nota offline" })])
        expect(screen.queryByText(i18n.t("workOrders.execution.save.saved"))).not.toBeInTheDocument()
      }
      connection(false)
    }
    await settle()
    expect(screen.getByText(i18n.t("workOrders.offline.title"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("workOrders.execution.save.retrying"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("workOrders.execution.save.saved"))).not.toBeInTheDocument()
    expect(store.get("os_sync_queue")).toEqual([expect.objectContaining({ value: "nota offline" })])
    expect(toast.success).not.toHaveBeenCalled()
    connection(true)
    await settle()
    expect(saved).toBe("nota offline")
    expect(screen.queryByText(i18n.t("workOrders.offline.title"))).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(i18n.t("workOrders.offline.synced"), { duration: 3000 })
    releaseReload()
    releaseSession()
    await settle()
    expect(screen.queryByText(i18n.t("workOrders.offline.title"))).not.toBeInTheDocument()
    connection(true)
    await settle()
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(store.get("os_sync_queue")).toEqual([])
  })
})
