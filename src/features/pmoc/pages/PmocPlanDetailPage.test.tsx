import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PmocPlanDetailPage } from "@/features/pmoc/pages/PmocPlanDetailPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"
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
    updatePlan: vi.fn(),
    replaceTasks: vi.fn(),
    deletePlan: vi.fn(),
    PlanInUseError,
    isPlanInUseError: (error: unknown) => error instanceof PlanInUseError,
  }
})

import { getUnits } from "@/features/assets/services/unitsService"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import {
  deletePlan,
  getPlan,
  PlanInUseError,
  replaceTasks,
  updatePlan,
} from "@/features/pmoc/services/pmocService"

const getPlanMock = vi.mocked(getPlan)
const updatePlanMock = vi.mocked(updatePlan)
const replaceTasksMock = vi.mocked(replaceTasks)
const deletePlanMock = vi.mocked(deletePlan)
const getUnitsMock = vi.mocked(getUnits)
const listCategoriesMock = vi.mocked(listPlanAssetCategories)

const WRITE_PERMS = ["pmoc.plans.read", "pmoc.plans.write"] as const

function renderDetail(permissions: readonly string[] = WRITE_PERMS) {
  return render(
    <MemoryRouter initialEntries={[`/pmoc/${PLAN_ID}`]}>
      <TestPermissionProvider permissions={permissions} activeModules={["pmoc"]}>
        <Routes>
          <Route path="/pmoc/:id" element={<PmocPlanDetailPage />} />
          <Route path="/pmoc" element={<div>plans-list</div>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("PmocPlanDetailPage", () => {
  beforeEach(() => {
    getPlanMock.mockReset()
    updatePlanMock.mockReset()
    replaceTasksMock.mockReset()
    deletePlanMock.mockReset()
    getUnitsMock.mockReset()
    listCategoriesMock.mockReset()

    getPlanMock.mockResolvedValue({
      ...basePlanJson,
      originKind: "RolvixTemplate",
      sourceTemplateId: TEMPLATE_ID,
      sourceTemplateVersion: 1,
      autoGenerateEnabled: false,
    })
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
})
