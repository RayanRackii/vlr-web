import { AxiosError } from "axios"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { getCategories } from "@/features/assets/services/assetCategoriesService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const authSession = vi.hoisted(() => ({ access_token: "test" }))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    api: {
      get: vi.fn(),
      delete: vi.fn(),
    },
  }
})

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  getCategories: vi.fn(async () => []),
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(async () => []),
}))

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listActiveAssetFamilies: vi.fn(async () => []),
}))

import { api } from "@/lib/api"

function axiosErrorNetwork(): AxiosError {
  return new AxiosError("Network Error", "ERR_NETWORK")
}

const apiGet = vi.mocked(api.get)

const ASSET = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  familyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  attributes: {},
  name: "Quadra 1",
  tag: "Q-01",
  location: "Clube",
  status: "Active",
  isRentable: true,
  requiresMaintenance: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  scheduledDeletionAt: null,
}

describe("AssetsPage row menu tap targets", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockImplementation(async (url: string) => {
      if (url === "/api/assets") {
        return { data: [ASSET], status: 200 }
      }
      throw axiosErrorNetwork()
    })
  })

  it("gives Editar/Remover menu items at least a 44px tap target", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <TestPermissionProvider
          permissions={["inventory.assets.read", "inventory.assets.write"]}
          activeModules={["inventory"]}
        >
          <AssetsPage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )

    expect((await screen.findAllByText("Q-01")).length).toBeGreaterThan(0)

    const table = screen.getByRole("table")
    await user.click(
      within(table).getByRole("button", {
        name: i18n.t("assets.inventory.actions.rowMenu", { tag: "Q-01" }),
      }),
    )

    const editItem = await screen.findByRole("menuitem", {
      name: i18n.t("assets.actions.edit"),
    })
    const removeItem = screen.getByRole("menuitem", {
      name: i18n.t("assets.actions.remove"),
    })

    expect(editItem.className).toContain("min-h-11")
    expect(removeItem.className).toContain("min-h-11")
  })
})

const CAT_COURTS = "11111111-1111-4111-8111-111111111111"
const CAT_PUMPS = "22222222-2222-4222-8222-222222222222"

const LIST_ASSETS = [
  { ...ASSET, id: "a0000001-0000-4000-8000-000000000001", name: "Quadra 1", tag: "Q-01", location: "Clube", categoryId: CAT_COURTS },
  { ...ASSET, id: "a0000002-0000-4000-8000-000000000002", name: "Quadra 2", tag: "Q-02", location: "Clube", categoryId: CAT_COURTS },
  { ...ASSET, id: "a0000003-0000-4000-8000-000000000003", name: "Bomba Central", tag: "B-01", location: "Galpao", categoryId: CAT_PUMPS },
]

function category(id: string, name: string) {
  return { id, tenantId: ASSET.tenantId, name, createdAt: "2026-10-01T00:00:00.000Z", linkedAssetsCount: 0 }
}

function renderList() {
  return render(
    <MemoryRouter>
      <TestPermissionProvider
        permissions={["inventory.assets.read", "inventory.assets.write"]}
        activeModules={["inventory"]}
      >
        <AssetsPage />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("AssetsPage list, filters and bulk selection", () => {
  beforeEach(() => {
    apiGet.mockReset()
    vi.mocked(api.delete).mockReset()
    vi.mocked(api.delete).mockResolvedValue({ status: 204, data: null })
    vi.mocked(getCategories).mockResolvedValue([
      category(CAT_COURTS, "Quadras"),
      category(CAT_PUMPS, "Bombas"),
    ] as never)
    apiGet.mockImplementation(async (url: string) => {
      if (url === "/api/assets") {
        return { data: LIST_ASSETS, status: 200 }
      }
      throw axiosErrorNetwork()
    })
  })

  async function rowsInTable() {
    const table = await screen.findByRole("table")
    await within(table).findByText("Q-01")
    return table
  }

  const selectRowLabel = (tag: string) =>
    i18n.t("assets.inventory.actions.selectRow", { tag })

  it("renders one h1, the rows in the table and the card list", async () => {
    renderList()
    const table = await rowsInTable()

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(within(table).getAllByRole("row")).toHaveLength(4)
    expect(screen.getByRole("list", { name: i18n.t("nav.assets") })).toBeInTheDocument()
  })

  it("filters by name or tag and clears with the chip", async () => {
    const user = userEvent.setup()
    renderList()
    const table = await rowsInTable()
    const search = screen.getByRole("searchbox", {
      name: i18n.t("assets.inventory.filters.searchLabel"),
    })

    await user.type(search, "  bomba ")
    expect(within(table).queryByText("Q-01")).not.toBeInTheDocument()
    expect(within(table).getByText("B-01")).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "q-02")
    expect(within(table).getByText("Q-02")).toBeInTheDocument()
    expect(within(table).queryByText("Q-01")).not.toBeInTheDocument()

    await user.click(
      within(screen.getByRole("region", { name: i18n.t("assets.inventory.filters.label") })).getByRole("button", { name: /q-02/i }),
    )
    expect(within(table).getByText("Q-01")).toBeInTheDocument()
    expect(search).toHaveValue("")
  })

  it("narrows by category and location and clears with the chips", async () => {
    const user = userEvent.setup()
    renderList()
    const table = await rowsInTable()

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("assets.inventory.filters.category") }),
    )
    await user.click(await screen.findByRole("option", { name: "Bombas" }))
    expect(within(table).queryByText("Q-01")).not.toBeInTheDocument()
    expect(within(table).getByText("B-01")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: `${i18n.t("assets.inventory.filters.category")}: Bombas`,
      }),
    )
    expect(within(table).getByText("Q-01")).toBeInTheDocument()

    await user.click(
      screen.getByRole("combobox", { name: i18n.t("assets.inventory.filters.location") }),
    )
    await user.click(await screen.findByRole("option", { name: "Clube" }))
    expect(within(table).queryByText("B-01")).not.toBeInTheDocument()
    expect(within(table).getAllByText(/^Q-0/)).toHaveLength(2)

    await user.click(
      screen.getByRole("button", {
        name: `${i18n.t("assets.inventory.filters.location")}: Clube`,
      }),
    )
    expect(within(table).getByText("B-01")).toBeInTheDocument()
  })

  it("selects two rows, select-all takes the visible rows, bulk delete clears the selection", async () => {
    const user = userEvent.setup()
    renderList()
    const table = await rowsInTable()
    const bulkButton = (count: number) =>
      screen.getByRole("button", {
        name: i18n.t("assets.inventory.actions.bulkDeleteCount", { count }),
      })

    await user.click(within(table).getByRole("checkbox", { name: selectRowLabel("Q-01") }))
    await user.click(within(table).getByRole("checkbox", { name: selectRowLabel("B-01") }))
    expect(bulkButton(2)).toBeEnabled()

    await user.click(within(table).getByRole("checkbox", { name: selectRowLabel("B-01") }))
    await user.type(
      screen.getByRole("searchbox", { name: i18n.t("assets.inventory.filters.searchLabel") }),
      "quadra",
    )
    await user.click(
      within(table).getByRole("checkbox", { name: i18n.t("assets.inventory.actions.selectAll") }),
    )
    expect(within(table).getByRole("checkbox", { name: selectRowLabel("Q-02") })).toBeChecked()
    expect(bulkButton(2)).toBeEnabled()

    await user.click(bulkButton(2))
    const dialog = await screen.findByRole("dialog")
    await user.type(
      within(dialog).getByRole("textbox"),
      i18n.t("assets.deletion.bulkConfirmPhrase"),
    )
    await user.click(
      within(dialog).getByRole("button", { name: i18n.t("assets.deletion.confirm") }),
    )

    await vi.waitFor(() => {
      expect(api.delete).toHaveBeenCalledTimes(2)
    })
    expect(api.delete).toHaveBeenCalledWith(`/api/assets/${LIST_ASSETS[0].id}`)
    expect(api.delete).toHaveBeenCalledWith(`/api/assets/${LIST_ASSETS[1].id}`)
    expect(api.delete).not.toHaveBeenCalledWith(`/api/assets/${LIST_ASSETS[2].id}`)
    expect(
      await screen.findByRole("button", { name: i18n.t("assets.inventory.actions.bulkDelete") }),
    ).toBeDisabled()
  })

  it("selects a row through the card checkbox", async () => {
    const user = userEvent.setup()
    renderList()
    await rowsInTable()
    const cards = screen.getByRole("list", { name: i18n.t("nav.assets") })

    await user.click(within(cards).getByRole("checkbox", { name: selectRowLabel("Q-02") }))
    expect(
      screen.getByRole("button", {
        name: i18n.t("assets.inventory.actions.bulkDeleteCount", { count: 1 }),
      }),
    ).toBeEnabled()
  })
})
