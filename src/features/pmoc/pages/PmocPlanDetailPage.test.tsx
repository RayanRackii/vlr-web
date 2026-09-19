import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PmocPlanDetailPage } from "@/features/pmoc/pages/PmocPlanDetailPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
import {
  emptyCoverageJson,
  populatedCoverageJson,
} from "@/features/pmoc/test/coverageFixtures"
import {
  basePlanJson,
  CATEGORY_ID,
  PLAN_ID,
  TEMPLATE_ID,
  UNIT_ID,
} from "@/features/pmoc/test/pmocFixtures"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { access_token: "test" } }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocPlanCategoriesService", () => ({
  listPlanAssetCategories: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => {
  class PlanInUseError extends Error {
    readonly code = "PLAN_IN_USE" as const
  }

  return {
    getPlan: vi.fn(),
    getPlanCoverage: vi.fn(),
    updatePlan: vi.fn(),
    replaceTasks: vi.fn(),
    deletePlan: vi.fn(),
    PlanInUseError,
    isPlanInUseError: (error: unknown) => error instanceof PlanInUseError,
  }
})

vi.mock("@/features/users/services/usersService", () => ({
  getTechnicians: vi.fn(),
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => {
  class DuplicateWorkOrderError extends Error {
    readonly code = "DUPLICATE_WORK_ORDER" as const
  }

  return {
    getWorkOrders: vi.fn(),
    listWorkOrderAssets: vi.fn(),
    generateWorkOrderFromPlan: vi.fn(),
    DuplicateWorkOrderError,
    isDuplicateWorkOrderError: (error: unknown) =>
      error instanceof DuplicateWorkOrderError,
  }
})

import { getUnits } from "@/features/assets/services/unitsService"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import {
  deletePlan,
  getPlan,
  getPlanCoverage,
  PlanInUseError,
  replaceTasks,
  updatePlan,
} from "@/features/pmoc/services/pmocService"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  generateWorkOrderFromPlan,
  getWorkOrders,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"
import {
  matchingRegistryAsset,
  makeWorkOrder,
} from "@/features/workOrders/test/workOrderFixtures"
import { toast } from "sonner"

const getPlanMock = vi.mocked(getPlan)
const getPlanCoverageMock = vi.mocked(getPlanCoverage)
const updatePlanMock = vi.mocked(updatePlan)
const replaceTasksMock = vi.mocked(replaceTasks)
const deletePlanMock = vi.mocked(deletePlan)
const getUnitsMock = vi.mocked(getUnits)
const listCategoriesMock = vi.mocked(listPlanAssetCategories)
const getWorkOrdersMock = vi.mocked(getWorkOrders)
const listAssetsMock = vi.mocked(listWorkOrderAssets)
const getTechniciansMock = vi.mocked(getTechnicians)
const generateMock = vi.mocked(generateWorkOrderFromPlan)
const toastSuccess = vi.mocked(toast.success)

const WRITE_PERMS = ["pmoc.plans.read", "pmoc.plans.write"] as const
const OS_WRITE_PERMS = [
  ...WRITE_PERMS,
  "os.work_orders.read",
  "os.work_orders.create",
] as const
const OS_READ_PERMS = [...WRITE_PERMS, "os.work_orders.read"] as const

function renderDetail(
  permissions: readonly string[] = WRITE_PERMS,
  activeModules: readonly string[] = ["pmoc"],
) {
  return render(
    <MemoryRouter initialEntries={[`/pmoc/${PLAN_ID}`]}>
      <TestPermissionProvider permissions={permissions} activeModules={activeModules}>
        <Routes>
          <Route path="/pmoc/:id" element={<PmocPlanDetailPage />} />
          <Route path="/pmoc" element={<div>plans-list</div>} />
          <Route path="/os/:id" element={<div>os-detail</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("PmocPlanDetailPage", () => {
  beforeEach(() => {
    getPlanMock.mockReset()
    getPlanCoverageMock.mockReset()
    updatePlanMock.mockReset()
    replaceTasksMock.mockReset()
    deletePlanMock.mockReset()
    getUnitsMock.mockReset()
    listCategoriesMock.mockReset()
    getWorkOrdersMock.mockReset()
    listAssetsMock.mockReset()
    getTechniciansMock.mockReset()
    generateMock.mockReset()
    toastSuccess.mockReset()

    getPlanMock.mockResolvedValue({
      ...basePlanJson,
      originKind: "RolvixTemplate",
      sourceTemplateId: TEMPLATE_ID,
      sourceTemplateVersion: 1,
      autoGenerateEnabled: false,
    })
    getPlanCoverageMock.mockResolvedValue(emptyCoverageJson)
    updatePlanMock.mockResolvedValue({ ...basePlanJson, isActive: false })
    replaceTasksMock.mockResolvedValue({ ...basePlanJson })
    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
    ])
    listCategoriesMock.mockResolvedValue([{ id: CATEGORY_ID, name: "Split" }])
    getWorkOrdersMock.mockResolvedValue([])
    listAssetsMock.mockResolvedValue([matchingRegistryAsset])
    getTechniciansMock.mockResolvedValue([])
    generateMock.mockResolvedValue(makeWorkOrder())
  })

  it("shows origin, auto toggle, and checklist, and hides related OS / Gerar OS", async () => {
    const { container } = renderDetail()

    expect(
      await screen.findByText(i18n.t("pmoc.plans.origin.RolvixTemplate")),
    ).toBeInTheDocument()
    expect(screen.getByText(/v1/)).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("pmoc.plans.autoGenerateEnabled")),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("Verificar filtros")).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Gerar OS/i)
    expect(container.textContent).not.toMatch(/OS relacionadas/i)
    expect(container.querySelector("[data-testid='related-work-orders']")).toBeNull()
  })

  it("saves checklist edits keeping existing task ids", async () => {
    renderDetail()
    const user = userEvent.setup()

    const titleInput = await screen.findByDisplayValue("Verificar filtros")
    await user.clear(titleInput)
    await user.type(titleInput, "Filtros revisados")
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.actions.saveChecklist"),
      }),
    )

    await waitFor(() => {
      expect(replaceTasksMock).toHaveBeenCalled()
    })
    const payload = replaceTasksMock.mock.calls[0]?.[1] as {
      tasks: Array<{ id?: string; title: string }>
    }
    expect(payload.tasks[0]?.id).toBe(basePlanJson.tasks[0]?.id)
    expect(payload.tasks[0]?.title).toBe("Filtros revisados")
  })

  it("shows inline deactivate after DELETE 409 PLAN_IN_USE", async () => {
    deletePlanMock.mockRejectedValue(
      new PlanInUseError(i18n.t("pmoc.plans.errors.planInUse")),
    )

    renderDetail()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("pmoc.plans.actions.delete"),
      }),
    )

    expect(
      await screen.findByText(i18n.t("pmoc.plans.errors.planInUse")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.actions.deactivate"),
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.actions.deactivate"),
      }),
    )

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        PLAN_ID,
        expect.objectContaining({ isActive: false }),
      )
    })
  })

  it("A/L: write-capable OS user sees Gerar OS even when AutoGenerateEnabled is false", async () => {
    renderDetail(OS_WRITE_PERMS, ["pmoc", "os"])

    expect(
      (
        await screen.findAllByRole("button", {
          name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
        })
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(i18n.t("pmoc.plans.autoGenerateOff")),
    ).toBeInTheDocument()
  })

  it("B: read-only OS user does not see Gerar OS but can see related OS", async () => {
    renderDetail(OS_READ_PERMS, ["pmoc", "os"])

    expect(await screen.findByTestId("related-work-orders")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
      }),
    ).not.toBeInTheDocument()
  })

  it("hides Gerar OS when the OS module is inactive even with create permission", async () => {
    renderDetail(OS_WRITE_PERMS, ["pmoc"])

    expect(await screen.findByText(basePlanJson.name)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId("related-work-orders")).toBeNull()
  })

  it("D: successful generation stays on the plan and refetches related OS", async () => {
    const created = makeWorkOrder()
    getWorkOrdersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([created])
    generateMock.mockResolvedValue(created)

    renderDetail(OS_WRITE_PERMS, ["pmoc", "os"])
    const user = userEvent.setup()

    await user.click(
      (
        await screen.findAllByRole("button", {
          name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
        })
      )[0]!,
    )
    await user.click(
      await screen.findByRole("combobox", {
        name: i18n.t("workOrders.create.form.asset"),
      }),
    )
    await user.click(
      await screen.findByRole("option", { name: "AC-01 — Split sala 1" }),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.plans.generate.submit"),
      }),
    )

    await waitFor(() => {
      expect(generateMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(getWorkOrdersMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
    expect(getWorkOrdersMock).toHaveBeenCalledWith({
      maintenancePlanId: PLAN_ID,
    })
    expect(screen.getByText(basePlanJson.name)).toBeInTheDocument()
    expect(screen.queryByText("os-detail")).not.toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalled()
    expect(await screen.findByText("AC-01 — Split sala 1")).toBeInTheDocument()
    expect(getPlanCoverageMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it("S/T: coverage coexists with Gerar OS and related OS without merging tables", async () => {
    getPlanCoverageMock.mockResolvedValue(populatedCoverageJson)

    renderDetail(OS_WRITE_PERMS, ["pmoc", "os"])

    expect(await screen.findByTestId("plan-coverage")).toBeInTheDocument()
    expect(screen.getByTestId("related-work-orders")).toBeInTheDocument()
    expect(
      (
        await screen.findAllByRole("button", {
          name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
        })
      ).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(i18n.t("pmoc.plans.coverage.question"))).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("pmoc.plans.sections.relatedWorkOrders")),
    ).toBeInTheDocument()
  })

  it("N: AutoGenerateEnabled=false still shows coverage on the plan page", async () => {
    getPlanCoverageMock.mockResolvedValue(populatedCoverageJson)

    renderDetail(WRITE_PERMS, ["pmoc"])

    expect(await screen.findByTestId("plan-coverage")).toBeInTheDocument()
    expect(screen.getAllByTestId("coverage-asset-row")).toHaveLength(3)
    expect(
      screen.getByText(i18n.t("pmoc.plans.autoGenerateOff")),
    ).toBeInTheDocument()
  })

  it("refetches coverage after toggling AutoGenerateEnabled", async () => {
    getPlanCoverageMock.mockResolvedValue(populatedCoverageJson)
    updatePlanMock.mockResolvedValue({
      ...basePlanJson,
      originKind: "RolvixTemplate",
      sourceTemplateId: TEMPLATE_ID,
      sourceTemplateVersion: 1,
      autoGenerateEnabled: true,
    })

    renderDetail(WRITE_PERMS, ["pmoc"])
    const user = userEvent.setup()

    await screen.findByTestId("plan-coverage")
    expect(getPlanCoverageMock).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole("switch", {
        name: i18n.t("pmoc.plans.autoGenerateEnabled"),
      }),
    )

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(getPlanCoverageMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})
