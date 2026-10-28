import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssetsPage } from "@/features/assets/pages/AssetsPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const authSession = vi.hoisted(() => ({ access_token: "test" }))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: authSession }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Leitor",
    email: "leitor@example.com",
    role: "USER",
    tenantId: null,
    activeModules: ["inventory"],
    activeAssetFamilies: ["goods"],
    isTrial: false,
    isTrialReadOnly: false,
    notificationsEmailOnly: false,
    roles: [],
    permissions: ["inventory.assets.read"],
  })),
}))

vi.mock("@/features/assets/services/assetsService", () => ({
  getAssets: vi.fn(),
  getAssetById: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  getCategories: vi.fn(),
}))

vi.mock("@/features/assets/services/unitsService", () => ({
  getUnits: vi.fn(),
}))

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listActiveAssetFamilies: vi.fn(),
}))

import { getCategories } from "@/features/assets/services/assetCategoriesService"
import { listActiveAssetFamilies } from "@/features/assets/services/assetFamiliesService"
import { getAssetById, getAssets, updateAsset } from "@/features/assets/services/assetsService"
import { getUnits } from "@/features/assets/services/unitsService"

const getAssetsMock = vi.mocked(getAssets)
const getCategoriesMock = vi.mocked(getCategories)
const getUnitsMock = vi.mocked(getUnits)
const listFamiliesMock = vi.mocked(listActiveAssetFamilies)

const ASSET = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  categoryId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  familyId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  attributes: {},
  name: "Caçamba 1",
  tag: "B-01",
  location: "Pátio",
  status: "Active" as const,
  isRentable: false,
  requiresMaintenance: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  scheduledDeletionAt: null,
}

function renderPage(permissions: readonly string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider
        permissions={permissions}
        activeModules={["inventory"]}
      >
        <AssetsPage />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("AssetsPage permission-aware load", () => {
  beforeEach(() => {
    getAssetsMock.mockReset()
    getCategoriesMock.mockReset()
    getUnitsMock.mockReset()
    listFamiliesMock.mockReset()
    getAssetsMock.mockResolvedValue([ASSET])
    getCategoriesMock.mockRejectedValue(new Error("FORBIDDEN"))
    getUnitsMock.mockRejectedValue(new Error("FORBIDDEN"))
    listFamiliesMock.mockRejectedValue(new Error("FORBIDDEN"))
  })

  it.each([false, true])("shows the name and opens the existing view (write access: %s)", async (canWrite) => {
    const user = userEvent.setup()
    vi.mocked(getAssetById).mockResolvedValue(ASSET)
    listFamiliesMock.mockResolvedValue([{
      id: ASSET.familyId, key: "equipment", label: "Equipamentos", sortOrder: 0, isActive: true,
      fields: [{ key: "covered", type: "boolean", required: true, label: "Protegido" }],
    }])
    renderPage(canWrite ? ["inventory.assets.read", "inventory.assets.write"] : ["inventory.assets.read"])

    const table = await screen.findByRole("table")
    expect(await within(table).findByRole("columnheader", { name: /^Nome/ })).toBeInTheDocument()
    const names = await screen.findAllByRole("button", { name: ASSET.name })
    expect(names).toHaveLength(2)
    // Desktop and mobile both open the same existing wizard.
    await user.click(names[canWrite ? 0 : 1])
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByRole("textbox", { name: /^Nome/ })).toHaveValue(ASSET.name)
    expect(getAssetById).toHaveBeenCalledWith(ASSET.id)
    if (!canWrite) {
      expect(within(dialog).getByRole("textbox", { name: /^Nome/ })).toBeDisabled()
      const toggle = within(dialog).getByRole("switch", { name: /^Protegido/ })
      expect(toggle).toHaveAttribute("aria-disabled", "true")
      expect(toggle).toHaveAttribute("aria-checked", "false")
      await user.click(toggle)
      toggle.focus()
      await user.keyboard(" ")
      expect(toggle).toHaveAttribute("aria-checked", "false")
      expect(updateAsset).not.toHaveBeenCalled()
    }
  })

  it("keeps the asset list and hides create actions when lookups are forbidden", async () => {
    renderPage(["inventory.assets.read"])

    expect((await screen.findAllByText("B-01")).length).toBeGreaterThan(0)
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("assets.inventory.emptyNoTypesCta"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("assets.inventory.actions.add"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("assets.inventory.actions.rowMenu", { tag: "B-01" }),
      }),
    ).not.toBeInTheDocument()
  })

  it("shows the translated denial when the asset list itself is forbidden", async () => {
    getAssetsMock.mockRejectedValue(new Error("FORBIDDEN"))
    getCategoriesMock.mockResolvedValue([])
    getUnitsMock.mockResolvedValue([])
    listFamiliesMock.mockResolvedValue([])

    renderPage(["inventory.assets.read"])

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("rbac.errors.FORBIDDEN"),
    )
    expect(screen.queryByText("FORBIDDEN")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("assets.inventory.emptyNoTypesCta"),
      }),
    ).not.toBeInTheDocument()
  })

  it("offers Criar tipos only when the user can write categories and none exist", async () => {
    getAssetsMock.mockResolvedValue([])
    getCategoriesMock.mockResolvedValue([])
    getUnitsMock.mockResolvedValue([])
    listFamiliesMock.mockResolvedValue([])

    renderPage(["inventory.assets.read", "inventory.categories.write"])

    expect(
      (
        await screen.findAllByRole("button", {
          name: i18n.t("assets.inventory.emptyNoTypesCta"),
        })
      ).length,
    ).toBeGreaterThan(0)
  })
})
