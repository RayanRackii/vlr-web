import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
import { TenantTimeZoneProvider } from "@/contexts/TenantTimeZoneProvider"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/assets/services/assetsService", () => ({
  getAssets: vi.fn(async () => {
    throw new Error("must not call GET /api/assets")
  }),
}))

vi.mock("@/features/users/services/usersService", () => ({
  getTechnicians: vi.fn(),
}))

vi.mock("@/features/workOrders/services/workOrdersService", () => ({
  listWorkOrderAssets: vi.fn(),
  createWorkOrder: vi.fn(),
  generateWorkOrderFromPlan: vi.fn(),
}))

vi.mock("@/features/pmoc/services/pmocService", () => ({
  getPlans: vi.fn(async () => []),
}))

import { toast } from "sonner"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  createWorkOrder,
  generateWorkOrderFromPlan,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"
import { getPlans } from "@/features/pmoc/services/pmocService"
import { basePlanJson } from "@/features/pmoc/test/pmocFixtures"
import { matchingRegistryAsset } from "@/features/workOrders/test/workOrderFixtures"

const listAssetsMock = vi.mocked(listWorkOrderAssets)
const createWorkOrderMock = vi.mocked(createWorkOrder)
const getTechniciansMock = vi.mocked(getTechnicians)
const toastError = vi.mocked(toast.error)

const ASSET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const ASSET_LABEL = "AC-01 — Split sala 1"

describe("CreateWorkOrderPage asset picker", () => {
  beforeEach(() => {
    listAssetsMock.mockReset()
    getTechniciansMock.mockReset()
    getTechniciansMock.mockResolvedValue([])
  })

  it("loads assets from work-orders, not inventory, without requiresMaintenance filter", async () => {
    listAssetsMock.mockResolvedValue([
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: "Split sala 1",
        tag: "AC-01",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        status: "Active",
      },
    ])

    render(
      <MemoryRouter>
        <CreateWorkOrderPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(
      await screen.findByRole("combobox", {
        name: i18n.t("workOrders.create.form.asset"),
      }),
    )
    expect(await screen.findByText("AC-01 — Split sala 1")).toBeInTheDocument()
    expect(listAssetsMock).toHaveBeenCalled()
  })

  it("shows guidance when there are zero assets and never links to Ativos", async () => {
    listAssetsMock.mockResolvedValue([])

    const { container } = render(
      <MemoryRouter>
        <CreateWorkOrderPage />
      </MemoryRouter>,
    )

    expect(
      await screen.findByText(i18n.t("workOrders.create.emptyAssetsTitle")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("workOrders.create.emptyAssetsDescription")),
    ).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /ativos/i })).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Ativos/)
    expect(container.textContent).not.toMatch(/Asset Registry/i)
    expect(container.textContent).not.toMatch(/\/ativos/)
  })
})

describe("CreateWorkOrderPage validity gate", () => {
  beforeEach(() => {
    listAssetsMock.mockReset()
    createWorkOrderMock.mockReset()
    getTechniciansMock.mockReset()
    toastError.mockReset()
    getTechniciansMock.mockResolvedValue([])
    listAssetsMock.mockResolvedValue([
      {
        id: ASSET_ID,
        name: "Split sala 1",
        tag: "AC-01",
        unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        status: "Active",
      },
    ])
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <CreateWorkOrderPage />
      </MemoryRouter>,
    )
  }

  it("pre-fills today in the tenant time zone, not the UTC day", async () => {
    // 02:30Z on 21 Nov is still 20 Nov at 23:30 in America/Sao_Paulo (UTC-3).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-21T02:30:00Z") })
    try {
      render(
        <MemoryRouter>
          <TenantTimeZoneProvider timeZoneId="America/Sao_Paulo">
            <CreateWorkOrderPage />
          </TenantTimeZoneProvider>
        </MemoryRouter>,
      )
      expect(await screen.findByDisplayValue("20/11/2026")).toBeInTheDocument()
      expect(screen.queryByDisplayValue("21/11/2026")).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  async function selectAsset(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("combobox", {
        name: i18n.t("workOrders.create.form.asset"),
      }),
    )
    await user.click(await screen.findByRole("option", { name: ASSET_LABEL }))
  }

  it("keeps Criar OS clickable and lists what is missing", async () => {
    const user = userEvent.setup()
    renderPage()

    const submit = await screen.findByRole("button", {
      name: i18n.t("workOrders.create.submit"),
    })
    expect(screen.queryByRole("button", { name: i18n.t("common.back") })).not.toBeInTheDocument()
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("workOrders.create.validation.assetRequired"),
    )
    expect(createWorkOrderMock).not.toHaveBeenCalled()

    const task = screen.getByLabelText(i18n.t("workOrders.create.checklist.taskN", { n: 1 }))
    await user.type(task, "Inspecionar equipamento")
    await selectAsset(user)
    expect(submit).toBeEnabled()
    expect(createWorkOrderMock).not.toHaveBeenCalled()
  })

  it("re-enables Criar OS after a server error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createWorkOrderMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject
        }),
    )
    renderPage()

    const task = await screen.findByLabelText(
      i18n.t("workOrders.create.checklist.taskN", { n: 1 }),
    )
    await user.type(task, "Inspecionar equipamento")
    await selectAsset(user)

    const submit = screen.getByRole("button", {
      name: i18n.t("workOrders.create.submit"),
    })
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(submit).toBeDisabled()
    })

    rejectCreate(new Error("Falha ao criar a OS"))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao criar a OS",
    )
    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("workOrders.create.submit"),
        }),
      ).toBeEnabled()
    })
    expect(task).toHaveValue("Inspecionar equipamento")
    expect(
      screen.getByRole("combobox", {
        name: i18n.t("workOrders.create.form.asset"),
      }),
    ).toHaveTextContent(ASSET_LABEL)
    expect(screen.queryByRole("button", { name: i18n.t("common.back") })).not.toBeInTheDocument()
    expect(toastError).toHaveBeenCalledWith("Falha ao criar a OS")
    expect(createWorkOrderMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(i18n.t("workOrders.create.redirecting"))).not.toBeInTheDocument()

    createWorkOrderMock.mockResolvedValueOnce({ id: "os-1" } as Awaited<
      ReturnType<typeof createWorkOrder>
    >)
    await user.click(
      screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }),
    )
    expect(
      await screen.findByRole("button", {
        name: i18n.t("workOrders.create.redirecting"),
      }),
    ).toBeDisabled()
    expect(task).toHaveValue("Inspecionar equipamento")
    expect(createWorkOrderMock).toHaveBeenCalledTimes(2)
  })

  it("numbers the ad-hoc task from 1 and opens the created work order", async () => {
    const user = userEvent.setup()
    const created = makeWorkOrder()
    createWorkOrderMock.mockResolvedValue(created)

    render(
      <MemoryRouter initialEntries={["/os/nova"]}>
        <Routes>
          <Route path="/os/nova" element={<CreateWorkOrderPage />} />
          <Route path="/os/:id" element={<div>os-detail</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const task = await screen.findByLabelText(
      i18n.t("workOrders.create.checklist.taskN", { n: 1 }),
    )
    await user.type(task, "Inspecionar equipamento")
    await selectAsset(user)
    await user.click(
      screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }),
    )

    expect(createWorkOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [expect.objectContaining({ order: 1 })],
      }),
    )
    expect(await screen.findByText("os-detail", {}, { timeout: 6000 })).toBeInTheDocument()
  }, 10000)
})

describe("CreateWorkOrderPage checklist modes", () => {
  const user = userEvent.setup()
  const otherCategoryAsset = {
    ...matchingRegistryAsset,
    id: "cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd",
    name: "Bomba",
    tag: "PU-01",
    categoryId: "eeeeeeee-0000-4eee-8eee-eeeeeeeeeeee",
  }

  beforeEach(() => {
    listAssetsMock.mockReset()
    createWorkOrderMock.mockReset()
    vi.mocked(generateWorkOrderFromPlan).mockReset()
    vi.mocked(getPlans).mockReset()
    getTechniciansMock.mockReset()
    getTechniciansMock.mockResolvedValue([])
    listAssetsMock.mockResolvedValue([matchingRegistryAsset, otherCategoryAsset])
    vi.mocked(getPlans).mockResolvedValue([basePlanJson])
    createWorkOrderMock.mockResolvedValue(makeWorkOrder())
  })

  function renderPage(props: Parameters<typeof CreateWorkOrderPage>[0] = {}) {
    return render(
      <MemoryRouter>
        <CreateWorkOrderPage {...props} />
      </MemoryRouter>,
    )
  }

  it("hides the plan option when there are no plans and starts in ad hoc mode", async () => {
    vi.mocked(getPlans).mockResolvedValue([])
    renderPage()
    await screen.findByRole("combobox", { name: i18n.t("workOrders.create.form.asset") })
    expect(screen.queryByRole("radio", { name: i18n.t("workOrders.create.mode.plan") })).not.toBeInTheDocument()
    expect(screen.getByLabelText(i18n.t("workOrders.create.checklist.taskN", { n: 1 }))).toBeInTheDocument()
  })

  it("adds, reorders and removes ad hoc tasks and sends them in order", async () => {
    renderPage()
    await user.type(await screen.findByLabelText(i18n.t("workOrders.create.checklist.taskN", { n: 1 })), "Primeira")
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.checklist.add") }))
    await user.type(screen.getByLabelText(i18n.t("workOrders.create.checklist.taskN", { n: 2 })), "Segunda")
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.checklist.add") }))
    await user.type(screen.getByLabelText(i18n.t("workOrders.create.checklist.taskN", { n: 3 })), "Terceira")
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.checklist.moveUp", { n: 3 }) }))
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.checklist.remove", { n: 1 }) }))

    await user.click(await screen.findByRole("combobox", { name: i18n.t("workOrders.create.form.asset") }))
    await user.click(await screen.findByRole("option", { name: "AC-01 — Split sala 1" }))
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }))

    await waitFor(() => expect(createWorkOrderMock).toHaveBeenCalledTimes(1))
    expect(createWorkOrderMock.mock.calls[0]?.[0]).toMatchObject({
      maintenancePlanId: null,
      tasks: [
        expect.objectContaining({ title: "Terceira", order: 1, planTaskId: null, isMandatory: true }),
        expect.objectContaining({ title: "Segunda", order: 2, planTaskId: null }),
      ],
    })
  })

  it("keeps at least one ad hoc row and blocks a blank checklist", async () => {
    renderPage()
    expect(
      await screen.findByRole("button", { name: i18n.t("workOrders.create.checklist.remove", { n: 1 }) }),
    ).toBeDisabled()
    await user.click(await screen.findByRole("combobox", { name: i18n.t("workOrders.create.form.asset") }))
    await user.click(await screen.findByRole("option", { name: "AC-01 — Split sala 1" }))
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(i18n.t("workOrders.create.validation.taskRequired"))
    expect(createWorkOrderMock).not.toHaveBeenCalled()
  })

  it("uses a plan checklist: filters assets by the plan and generates from the plan", async () => {
    vi.mocked(generateWorkOrderFromPlan).mockResolvedValue(makeWorkOrder())
    renderPage()
    await user.click(await screen.findByRole("radio", { name: i18n.t("workOrders.create.mode.plan") }))
    await user.click(screen.getByRole("combobox", { name: i18n.t("workOrders.create.plan.label") }))
    await user.click(await screen.findByRole("option", { name: basePlanJson.name }))
    expect(screen.getByText(basePlanJson.tasks[0]?.title ?? "")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: i18n.t("workOrders.create.form.asset") }))
    expect(await screen.findAllByRole("option")).toHaveLength(1)
    await user.click(screen.getByRole("option", { name: "AC-01 — Split sala 1" }))
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }))

    await waitFor(() =>
      expect(generateWorkOrderFromPlan).toHaveBeenCalledWith(
        expect.objectContaining({ planId: basePlanJson.id, assetId: matchingRegistryAsset.id }),
      ),
    )
    expect(createWorkOrderMock).not.toHaveBeenCalled()
  })

  it("requires a plan when the plan checklist is chosen", async () => {
    renderPage()
    await user.click(await screen.findByRole("radio", { name: i18n.t("workOrders.create.mode.plan") }))
    await user.click(await screen.findByRole("combobox", { name: i18n.t("workOrders.create.form.asset") }))
    await user.click(await screen.findByRole("option", { name: "AC-01 — Split sala 1" }))
    await user.click(screen.getByRole("button", { name: i18n.t("workOrders.create.submit") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(i18n.t("workOrders.create.validation.planRequired"))
    expect(generateWorkOrderFromPlan).not.toHaveBeenCalled()
  })

  it("opens in plan mode with a prefilled plan", async () => {
    renderPage({ maintenance: true, sourcePlan: basePlanJson })
    expect(await screen.findByRole("radio", { name: i18n.t("workOrders.create.mode.plan") })).toBeChecked()
    expect(screen.getByRole("combobox", { name: i18n.t("workOrders.create.plan.label") })).toHaveTextContent(basePlanJson.name)
    expect(screen.queryByLabelText(i18n.t("workOrders.create.checklist.taskN", { n: 1 }))).not.toBeInTheDocument()
  })
})
