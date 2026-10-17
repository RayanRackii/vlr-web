import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import { makeWorkOrder } from "@/features/workOrders/test/workOrderFixtures"
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
}))

import { toast } from "sonner"
import { getTechnicians } from "@/features/users/services/usersService"
import {
  createWorkOrder,
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"

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

  async function selectAsset(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("combobox", {
        name: i18n.t("workOrders.create.form.asset"),
      }),
    )
    await user.click(await screen.findByRole("option", { name: ASSET_LABEL }))
  }

  it("keeps Criar OS disabled until the form schema is valid and leaves Voltar free", async () => {
    const user = userEvent.setup()
    renderPage()

    const submit = await screen.findByRole("button", {
      name: i18n.t("workOrders.create.submit"),
    })
    const back = screen.getByRole("button", { name: i18n.t("common.back") })
    expect(submit).toBeDisabled()
    expect(back).toBeEnabled()

    const task = screen.getByLabelText(i18n.t("workOrders.create.form.task"))
    await user.type(task, "   ")
    expect(submit).toBeDisabled()
    expect(createWorkOrderMock).not.toHaveBeenCalled()

    await user.clear(task)
    await user.type(task, "Inspecionar equipamento")
    expect(submit).toBeDisabled()

    await selectAsset(user)
    expect(submit).toBeEnabled()
    expect(back).toBeEnabled()

    const date = screen.getByLabelText(
      i18n.t("workOrders.create.form.scheduledDate"),
    )
    await user.clear(date)
    expect(submit).toBeDisabled()
    expect(back).toBeEnabled()

    await user.type(date, "2026-10-14")
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
      i18n.t("workOrders.create.form.task"),
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
    expect(screen.getByRole("button", { name: i18n.t("common.back") })).toBeEnabled()
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
      i18n.t("workOrders.create.form.task"),
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
