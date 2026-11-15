import { render, screen, waitFor, within } from "@testing-library/react"
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

type User = ReturnType<typeof userEvent.setup>

async function openMenu(user: User) {
  await user.click(await screen.findByRole("button", { name: i18n.t("pmoc.planDetail.actions.more") }))
}

async function chooseMenuItem(user: User, name: string) {
  await openMenu(user)
  await user.click(await screen.findByRole("menuitem", { name }))
}

function saveButton() {
  return screen.getByRole("button", { name: i18n.t("pmoc.planDetail.actions.save") })
}

function coverageTableRows() {
  return screen.getAllByTestId("coverage-asset-row").filter((row) => row.tagName === "TR")
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

  it("presents the invalid plan name only once", async () => {
    const user = userEvent.setup()
    renderDetail()
    const name = await screen.findByLabelText(i18n.t("pmoc.create.form.name"))
    await user.clear(name)
    await user.tab()
    expect(screen.getAllByText(i18n.t("pmoc.create.validation.nameRequired"))).toHaveLength(1)
  })

  it("waits for blur before explaining a partial due date and clears the error when valid", async () => {
    const user = userEvent.setup()
    renderDetail()
    const date = await screen.findByLabelText(i18n.t("pmoc.scheduling.firstDue"))
    const message = i18n.t("common.datePicker.invalid")
    await user.clear(date)
    await user.type(date, "1")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    await user.type(date, "4/")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
    await user.tab()
    expect(screen.getAllByText(message)).toHaveLength(1)
    await user.clear(date)
    await user.type(date, "14/10/2026")
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })

  it("shows the status and origin as badges, the checklist, and hides related OS / Gerar OS", async () => {
    const { container } = renderDetail()

    expect(
      await screen.findByText(`${i18n.t("pmoc.planDetail.badges.origin.RolvixTemplate")} v1`),
    ).toBeInTheDocument()
    expect(screen.getByText(i18n.t("pmoc.plans.status.active"))).toBeInTheDocument()
    // Automatic generation is off in this fixture: no badge, and no separate toggle cards.
    expect(screen.queryByText(i18n.t("pmoc.planDetail.badges.automatic"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("pmoc.plans.sections.origin"))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t("pmoc.plans.autoGenerateEnabled"))).not.toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: i18n.t("pmoc.plans.columns.status") })).not.toBeInTheDocument()
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
    await user.click(saveButton())

    await waitFor(() => {
      expect(replaceTasksMock).toHaveBeenCalled()
    })
    expect(updatePlanMock).not.toHaveBeenCalled()
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

    await chooseMenuItem(user, i18n.t("pmoc.plans.actions.delete"))

    const dialog = await screen.findByRole("alertdialog")
    expect(deletePlanMock).not.toHaveBeenCalled()
    expect(dialog).toHaveTextContent(i18n.t("pmoc.plans.deleteConfirm.description"))
    expect(
      within(dialog).getByRole("button", {
        name: i18n.t("pmoc.plans.actions.deactivate"),
      }),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("pmoc.plans.actions.delete"),
      }),
    )

    expect(
      await screen.findByText(i18n.t("pmoc.plans.errors.planInUse")),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
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
    expect(screen.queryByText(i18n.t("pmoc.planDetail.badges.automatic"))).not.toBeInTheDocument()
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
    expect(await screen.findByTestId("coverage-summary")).toHaveTextContent("1 equipamento atrasado · 1 vence hoje")
    expect(
      screen.getByText(i18n.t("pmoc.plans.sections.relatedWorkOrders")),
    ).toBeInTheDocument()
  })

  it("N: AutoGenerateEnabled=false still shows coverage on the plan page", async () => {
    getPlanCoverageMock.mockResolvedValue(populatedCoverageJson)

    renderDetail(WRITE_PERMS, ["pmoc"])

    expect(await screen.findByTestId("plan-coverage")).toBeInTheDocument()
    await screen.findByTestId("coverage-summary")
    expect(coverageTableRows()).toHaveLength(3)
    expect(screen.queryByText(i18n.t("pmoc.planDetail.badges.automatic"))).not.toBeInTheDocument()
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

    await chooseMenuItem(user, i18n.t("pmoc.planDetail.actions.enableAuto"))

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        PLAN_ID,
        expect.objectContaining({ autoGenerateEnabled: true }),
      )
    })
    expect(await screen.findByText(i18n.t("pmoc.planDetail.badges.automatic"))).toBeInTheDocument()
    await waitFor(() => {
      expect(getPlanCoverageMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it("G/H/I/J/K: loads and submits interval and first due without Frequency", async () => {
    updatePlanMock.mockResolvedValue({
      ...basePlanJson,
      intervalDays: 45,
      firstDueDate: "2026-01-15",
    })
    renderDetail()
    const user = userEvent.setup()

    const monthly = await screen.findByRole("button", {
      name: i18n.t("pmoc.newPlan.form.presets.monthly"),
    })
    const firstDue = screen.getByLabelText(i18n.t("pmoc.scheduling.firstDue"))
    expect(monthly).toHaveAttribute("aria-pressed", "true")
    expect(firstDue).toHaveValue("01/10/2026")

    await user.click(screen.getByRole("button", { name: i18n.t("pmoc.newPlan.form.presets.custom") }))
    const interval = screen.getByRole("spinbutton", {
      name: i18n.t("pmoc.newPlan.form.customDays"),
    })
    expect(interval).toHaveValue(30)
    await user.clear(interval)
    await user.type(interval, "45")
    await user.clear(firstDue)
    await user.type(firstDue, "15/01/2026")
    await user.click(saveButton())

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        PLAN_ID,
        expect.objectContaining({
          intervalDays: 45,
          firstDueDate: "2026-01-15",
        }),
      )
    })
  })

  it("saves the plan name and description with the header", async () => {
    updatePlanMock.mockResolvedValue({
      ...basePlanJson,
      name: "Plano revisado",
      description: "Escopo atualizado",
    })
    renderDetail()
    const user = userEvent.setup()

    const name = await screen.findByLabelText(i18n.t("pmoc.create.form.name"))
    await user.clear(name)
    await user.type(name, "Plano revisado")
    const description = screen.getByLabelText(i18n.t("pmoc.create.form.description"))
    await user.clear(description)
    await user.type(description, "Escopo atualizado")
    await user.click(saveButton())

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        PLAN_ID,
        expect.objectContaining({
          name: "Plano revisado",
          description: "Escopo atualizado",
        }),
      )
    })
  })

  it("shows copied number and single-choice configuration from a template plan", async () => {
    const choiceId = "99999999-9999-4999-8999-999999999999"
    getPlanMock.mockResolvedValue({
      ...basePlanJson,
      originKind: "RolvixTemplate",
      sourceTemplateId: TEMPLATE_ID,
      sourceTemplateVersion: 1,
      tasks: [
        {
          ...basePlanJson.tasks[0]!,
          title: "Medir",
          inputType: "Number",
          configuration: JSON.stringify({ min: 1, max: 10, unit: "bar" }),
        },
        {
          ...basePlanJson.tasks[0]!,
          id: choiceId,
          title: "Estado",
          inputType: "SingleChoice",
          order: 2,
          configuration: JSON.stringify({ options: ["Ok", "Revisar"] }),
        },
      ],
    })

    renderDetail()

    expect(await screen.findByLabelText(i18n.t("pmoc.create.tasks.min"))).toHaveValue(1)
    expect(screen.getByLabelText(i18n.t("pmoc.create.tasks.max"))).toHaveValue(10)
    expect(screen.getByLabelText(i18n.t("pmoc.create.tasks.unit"))).toHaveValue("bar")
    expect(
      screen.getByLabelText(i18n.t("pmoc.create.tasks.optionLabel", { number: 1 })),
    ).toHaveValue("Ok")
    expect(
      screen.getByLabelText(i18n.t("pmoc.create.tasks.optionLabel", { number: 2 })),
    ).toHaveValue("Revisar")
  })

  it("explains why save stays disabled for an empty title, a bad interval, or min greater than max", async () => {
    renderDetail()
    const user = userEvent.setup()

    const title = await screen.findByDisplayValue("Verificar filtros")
    await user.clear(title)
    await user.tab()
    expect(saveButton()).toBeDisabled()
    expect(
      screen.getAllByText(i18n.t("pmoc.create.validation.taskTitleRequired")).length,
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: i18n.t("pmoc.newPlan.form.presets.custom") }))
    const interval = screen.getByRole("spinbutton", {
      name: i18n.t("pmoc.newPlan.form.customDays"),
    })
    await user.clear(interval)
    await user.type(interval, "0")
    await user.tab()
    expect(saveButton()).toBeDisabled()
    expect(
      screen.getAllByText(i18n.t("pmoc.scheduling.intervalInvalid")).length,
    ).toBeGreaterThan(0)

    await user.type(title, "Medir")
    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("pmoc.create.tasks.inputType"),
      }),
    )
    await user.click(
      await screen.findByRole("option", { name: i18n.t("pmoc.taskInputTypes.Number") }),
    )
    await user.type(screen.getByLabelText(i18n.t("pmoc.create.tasks.min")), "8")
    await user.type(screen.getByLabelText(i18n.t("pmoc.create.tasks.max")), "2")
    await user.tab()
    expect(
      screen.getAllByText(i18n.t("pmoc.create.validation.numberRangeInvalid")).length,
    ).toBeGreaterThan(0)
    expect(saveButton()).toBeDisabled()
  })

  it("asks before removing a task and labels the trash button", async () => {
    renderDetail()
    const user = userEvent.setup()

    expect(
      await screen.findByRole("button", {
        name: i18n.t("pmoc.create.actions.removeTaskNamed", { number: 1 }),
      }),
    ).toHaveAttribute(
      "aria-label",
      i18n.t("pmoc.create.actions.removeTaskNamed", { number: 1 }),
    )

    await user.click(
      screen.getByRole("button", { name: i18n.t("pmoc.create.actions.addTask") }),
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.create.actions.removeTaskNamed", { number: 2 }),
      }),
    )

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent(
      i18n.t("pmoc.create.tasks.removeConfirmDescription"),
    )
    expect(screen.getAllByLabelText(i18n.t("pmoc.create.tasks.title"))).toHaveLength(2)

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("pmoc.create.actions.removeTask"),
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(screen.getAllByLabelText(i18n.t("pmoc.create.tasks.title"))).toHaveLength(1)
  })

  it("hides Gerar OS on an inactive plan and explains why", async () => {
    getPlanMock.mockResolvedValue({
      ...basePlanJson,
      isActive: false,
      originKind: "RolvixTemplate",
      sourceTemplateId: TEMPLATE_ID,
      sourceTemplateVersion: 1,
      autoGenerateEnabled: false,
    })

    renderDetail(OS_WRITE_PERMS, ["pmoc", "os"])

    expect(await screen.findByText(basePlanJson.name)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("pmoc.plans.actions.generateWorkOrder"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("pmoc.plans.generate.inactivePlan")),
    ).toBeInTheDocument()
  })

  it("deactivates from the delete confirmation without calling delete", async () => {
    renderDetail()
    const user = userEvent.setup()

    await chooseMenuItem(user, i18n.t("pmoc.plans.actions.delete"))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("pmoc.plans.actions.deactivate"),
      }),
    )

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(
        PLAN_ID,
        expect.objectContaining({ isActive: false }),
      )
    })
    expect(deletePlanMock).not.toHaveBeenCalled()
  })

  it("keeps the single SaveBar disabled until something changes and removes the old save buttons", async () => {
    renderDetail()
    const user = userEvent.setup()

    await screen.findByDisplayValue("Verificar filtros")
    expect(saveButton()).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Salvar dados do plano" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Salvar checklist" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: i18n.t("pmoc.planDetail.actions.save") })).toHaveLength(1)

    await user.type(screen.getByLabelText(i18n.t("pmoc.create.form.name")), " 2")
    expect(saveButton()).toBeEnabled()
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(screen.getByLabelText(i18n.t("pmoc.create.form.name"))).toHaveValue(basePlanJson.name)
    expect(saveButton()).toBeDisabled()
  })

  it("saves the plan data and the checklist together with one click", async () => {
    updatePlanMock.mockResolvedValue({ ...basePlanJson, name: "Plano novo" })
    replaceTasksMock.mockResolvedValue({ ...basePlanJson, name: "Plano novo" })
    renderDetail()
    const user = userEvent.setup()

    const name = await screen.findByLabelText(i18n.t("pmoc.create.form.name"))
    await user.clear(name)
    await user.type(name, "Plano novo")
    const title = screen.getByDisplayValue("Verificar filtros")
    await user.clear(title)
    await user.type(title, "Trocar filtros")
    await user.click(saveButton())

    await waitFor(() => {
      expect(updatePlanMock).toHaveBeenCalledWith(PLAN_ID, expect.objectContaining({ name: "Plano novo" }))
      expect(replaceTasksMock).toHaveBeenCalledTimes(1)
    })
    expect(toastSuccess).toHaveBeenCalledWith(i18n.t("pmoc.planDetail.toast.saved"))
    await waitFor(() => expect(saveButton()).toBeDisabled())
  })

  it("reports a checklist failure after the plan data was saved and keeps the edits", async () => {
    updatePlanMock.mockResolvedValue({ ...basePlanJson, name: "Plano novo" })
    replaceTasksMock.mockRejectedValue(new Error("boom"))
    renderDetail()
    const user = userEvent.setup()

    const name = await screen.findByLabelText(i18n.t("pmoc.create.form.name"))
    await user.clear(name)
    await user.type(name, "Plano novo")
    const title = screen.getByDisplayValue("Verificar filtros")
    await user.clear(title)
    await user.type(title, "Trocar filtros")
    await user.click(saveButton())

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(i18n.t("pmoc.planDetail.errors.partialSave"))
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue("Trocar filtros")).toBeInTheDocument()
    // Only the checklist is still pending: a retry must not resend the plan data.
    updatePlanMock.mockClear()
    replaceTasksMock.mockResolvedValue({ ...basePlanJson, name: "Plano novo" })
    await user.click(saveButton())
    await waitFor(() => expect(replaceTasksMock).toHaveBeenCalledTimes(2))
    expect(updatePlanMock).not.toHaveBeenCalled()
  })

  it("shows Automático in the header and moves the toggles into the menu", async () => {
    getPlanMock.mockResolvedValue({ ...basePlanJson, autoGenerateEnabled: true })
    updatePlanMock.mockResolvedValue({ ...basePlanJson, autoGenerateEnabled: true, isActive: false })
    renderDetail()
    const user = userEvent.setup()

    expect(await screen.findByText(i18n.t("pmoc.planDetail.badges.automatic"))).toBeInTheDocument()
    expect(screen.getAllByText(i18n.t("pmoc.planDetail.badges.origin.Custom")).some((node) => node.getAttribute("data-slot") === "badge")).toBe(true)
    await openMenu(user)
    expect(await screen.findByRole("menuitem", { name: i18n.t("pmoc.planDetail.actions.disableAuto") })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: i18n.t("pmoc.plans.actions.delete") })).toBeInTheDocument()
    await user.click(screen.getByRole("menuitem", { name: i18n.t("pmoc.plans.actions.deactivate") }))
    await waitFor(() => expect(updatePlanMock).toHaveBeenCalledWith(PLAN_ID, expect.objectContaining({ isActive: false })))
    expect(await screen.findByText(i18n.t("pmoc.plans.status.inactive"))).toBeInTheDocument()
  })

  it("is read-only without write permission: no save bar and no menu", async () => {
    renderDetail(["pmoc.plans.read"], ["pmoc"])

    expect(await screen.findByText("Verificar filtros")).toBeInTheDocument()
    expect(screen.getByTestId("plan-first-due-readonly")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("pmoc.planDetail.actions.save") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("pmoc.planDetail.actions.more") })).not.toBeInTheDocument()
    expect(screen.getByText("Sim/Não", { exact: false })).toBeInTheDocument()
  })
})
