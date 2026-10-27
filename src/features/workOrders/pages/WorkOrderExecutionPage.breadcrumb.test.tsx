import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { useContext } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BreadcrumbTitleProvider } from "@/components/layout/BreadcrumbTitleProvider"
import { BreadcrumbTitleContext } from "@/components/layout/useBreadcrumbTitle"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { WorkOrderExecutionPage } from "@/features/workOrders/pages/WorkOrderExecutionPage"
import { makeWorkOrder, WORK_ORDER_ID } from "@/features/workOrders/test/workOrderFixtures"
import i18n from "@/lib/i18n"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/lib/offlineSync", () => ({
  processSyncQueue: vi.fn(async () => ({ processed: 0, remaining: 0, conflicts: [] })),
  enqueueTaskValuePatch: vi.fn(),
  isNetworkConnectivityError: () => false,
  listQueuedTaskIds: vi.fn(async () => []),
  listSyncConflicts: vi.fn(async () => []),
  subscribeSyncQueue: vi.fn(() => () => undefined),
  clearSyncConflict: vi.fn(),
  retrySyncConflict: vi.fn(async () => ({ processed: 0, remaining: 0, conflicts: [] })),
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => ({
  getWorkOrderById: vi.fn(),
  updateTaskValue: vi.fn(),
  updateWorkOrderStatus: vi.fn(),
  uploadWorkOrderTaskFile: vi.fn(),
  getWorkOrderTaskFileUrl: vi.fn(),
  updateWorkOrderAssignee: vi.fn(),
}))

import { getWorkOrderById } from "@/features/workOrders/services/workOrdersService"

function TitleProbe() {
  const { title } = useContext(BreadcrumbTitleContext)
  return <output data-testid="crumb">{title?.value ?? ""}</output>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/os/${WORK_ORDER_ID}`]}>
      <TestPermissionProvider permissions={["os.work_orders.read"]} activeModules={["os"]}>
        <BreadcrumbTitleProvider>
          <TitleProbe />
          <Routes>
            <Route path="/os/:id" element={<WorkOrderExecutionPage />} />
          </Routes>
        </BreadcrumbTitleProvider>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("WorkOrderExecutionPage breadcrumb", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it.each([
    ["pt-BR", "OS 99999999"],
    ["en", "WO 99999999"],
    ["es", "OT 99999999"],
  ])("names the work order itself with the asset as context (%s)", async (lng, prefix) => {
    await i18n.changeLanguage(lng)
    const workOrder = makeWorkOrder()
    vi.mocked(getWorkOrderById).mockResolvedValue(workOrder)
    renderPage()
    await waitFor(() =>
      expect(screen.getByTestId("crumb")).toHaveTextContent(`${prefix} · ${workOrder.asset.name}`),
    )
    expect(screen.getByTestId("crumb").textContent).not.toBe(workOrder.asset.name)
  })
})
