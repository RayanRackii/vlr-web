import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CreateWorkOrderPage } from "@/features/workOrders/pages/CreateWorkOrderPage"
import i18n from "@/lib/i18n"

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

import { getTechnicians } from "@/features/users/services/usersService"
import {
  listWorkOrderAssets,
} from "@/features/workOrders/services/workOrdersService"

const listAssetsMock = vi.mocked(listWorkOrderAssets)
const getTechniciansMock = vi.mocked(getTechnicians)

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
