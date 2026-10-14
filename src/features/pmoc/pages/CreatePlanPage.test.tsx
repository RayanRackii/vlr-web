import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreatePlanPage } from "@/features/pmoc/pages/CreatePlanPage"
import i18n from "@/lib/i18n"

vi.mock("@/contexts/AuthContext", () => {
  const session = { access_token: "test" }
  return {
    useAuth: () => ({ session }),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
  }
})

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  getCategories: vi.fn(async () => {
    throw new Error("must not call GET /api/asset-categories")
  }),
}))

vi.mock("@/features/pmoc/services/pmocPlanCategoriesService", () => ({
  listPlanAssetCategories: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  createPlan: vi.fn(),
  getGlobalTemplates: vi.fn(async () => {
    throw new Error("CreatePlanPage must not import templates")
  }),
}))

import { getUnits } from "@/features/assets/services/unitsService"
import { listPlanAssetCategories } from "@/features/pmoc/services/pmocPlanCategoriesService"
import { createPlan } from "@/features/pmoc/services/pmocService"

const getUnitsMock = vi.mocked(getUnits)
const listCategoriesMock = vi.mocked(listPlanAssetCategories)
const createPlanMock = vi.mocked(createPlan)

const UNIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

describe("CreatePlanPage category picker", () => {
  beforeEach(() => {
    getUnitsMock.mockReset()
    listCategoriesMock.mockReset()
    getUnitsMock.mockResolvedValue([
      {
        id: UNIT_ID,
        tenantId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        name: "Sede",
        code: "SEDE",
        isActive: true,
      },
    ])
  })

  it("shows guidance when there are no categories and never links to Ativos", async () => {
    listCategoriesMock.mockResolvedValue([])

    const { container } = render(
      <MemoryRouter>
        <CreatePlanPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText(i18n.t("pmoc.create.emptyCategoriesTitle")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("pmoc.create.emptyCategoriesDescription")),
    ).toBeInTheDocument()
    expect(listCategoriesMock).toHaveBeenCalled()
    expect(screen.queryByRole("link", { name: /ativos/i })).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Ativos/)
    expect(container.textContent).not.toMatch(/Asset Registry/i)
  })

  it("does not offer CREA / client-side template import", async () => {
    listCategoriesMock.mockResolvedValue([{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Split" }])

    const { container } = render(
      <MemoryRouter>
        <CreatePlanPage />
      </MemoryRouter>,
    )

    await screen.findByText(i18n.t("pmoc.create.title"))
    expect(container.textContent).not.toMatch(/\bCREA\b/i)
    expect(container.textContent).not.toMatch(/Cardápio/i)
    expect(
      screen.queryByRole("button", { name: /importar modelo/i }),
    ).not.toBeInTheDocument()
  })
})

const CATEGORY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

describe("CreatePlanPage validity gate", () => {
  beforeEach(() => {
    getUnitsMock.mockReset()
    listCategoriesMock.mockReset()
    createPlanMock.mockReset()
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

  function renderPage() {
    return render(
      <MemoryRouter>
        <CreatePlanPage />
      </MemoryRouter>,
    )
  }

  async function fillValidPlan(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      await screen.findByLabelText(i18n.t("pmoc.create.form.name")),
      "PMOC Split",
    )
    await user.click(
      screen.getByRole("combobox", { name: i18n.t("pmoc.create.form.unit") }),
    )
    await user.click(await screen.findByRole("option", { name: "Sede" }))
    await user.click(
      screen.getByRole("combobox", {
        name: i18n.t("pmoc.create.form.category"),
      }),
    )
    await user.click(await screen.findByRole("option", { name: "Split" }))
    await user.type(
      screen.getByRole("spinbutton", { name: i18n.t("pmoc.scheduling.interval") }),
      "30",
    )
    await user.type(
      screen.getByLabelText(i18n.t("pmoc.scheduling.firstDue")),
      "2026-10-14",
    )
    await user.type(
      screen.getByLabelText(i18n.t("pmoc.create.tasks.title")),
      "Limpar filtro",
    )
  }

  it("keeps Salvar plano disabled until the plan schema is valid and leaves Voltar and Cancelar free", async () => {
    const user = userEvent.setup()
    renderPage()

    const save = await screen.findByRole("button", {
      name: i18n.t("pmoc.create.actions.save"),
    })
    const back = screen.getByRole("button", {
      name: i18n.t("pmoc.create.actions.back"),
    })
    const cancel = screen.getByRole("button", { name: i18n.t("common.cancel") })
    const addTask = screen.getByRole("button", {
      name: i18n.t("pmoc.create.actions.addTask"),
    })
    expect(save).toBeDisabled()
    expect(back).toBeEnabled()
    expect(cancel).toBeEnabled()
    expect(addTask).toBeEnabled()

    const name = screen.getByLabelText(i18n.t("pmoc.create.form.name"))
    await user.type(name, "   ")
    expect(save).toBeDisabled()
    expect(createPlanMock).not.toHaveBeenCalled()

    await user.clear(name)
    await fillValidPlan(user)
    expect(save).toBeEnabled()

    const interval = screen.getByRole("spinbutton", {
      name: i18n.t("pmoc.scheduling.interval"),
    })
    await user.clear(interval)
    await user.type(interval, "0")
    expect(save).toBeDisabled()
    expect(back).toBeEnabled()
    expect(cancel).toBeEnabled()
    expect(addTask).toBeEnabled()

    await user.clear(interval)
    await user.type(interval, "30")
    expect(save).toBeEnabled()
    expect(createPlanMock).not.toHaveBeenCalled()
  })

  it("re-enables Salvar plano after a server error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createPlanMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject
        }),
    )
    renderPage()
    await fillValidPlan(user)

    const save = screen.getByRole("button", {
      name: i18n.t("pmoc.create.actions.save"),
    })
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("pmoc.create.actions.saving"),
        }),
      ).toBeDisabled()
    })

    rejectCreate(new Error("Não foi possível criar o plano."))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar o plano.",
    )
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("pmoc.create.actions.save"),
        }),
      ).toBeEnabled()
    })
    expect(screen.getByLabelText(i18n.t("pmoc.create.form.name"))).toHaveValue(
      "PMOC Split",
    )
    expect(
      screen.getByLabelText(i18n.t("pmoc.create.tasks.title")),
    ).toHaveValue("Limpar filtro")
    expect(
      screen.getByRole("spinbutton", {
        name: i18n.t("pmoc.scheduling.interval"),
      }),
    ).toHaveValue(30)
    expect(
      screen.getByLabelText(i18n.t("pmoc.scheduling.firstDue")),
    ).toHaveValue("2026-10-14")
    expect(
      screen.getByRole("button", { name: i18n.t("pmoc.create.actions.back") }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n.t("pmoc.create.success.created")),
    ).not.toBeInTheDocument()
    expect(createPlanMock).toHaveBeenCalledTimes(1)

    createPlanMock.mockResolvedValueOnce({ id: "plan-1" } as Awaited<
      ReturnType<typeof createPlan>
    >)
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("pmoc.create.actions.save"),
      }),
    )
    expect(
      await screen.findByText(i18n.t("pmoc.create.success.created")),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(i18n.t("pmoc.create.form.name"))).toHaveValue(
      "PMOC Split",
    )
    expect(createPlanMock).toHaveBeenCalledTimes(2)
  })
})
