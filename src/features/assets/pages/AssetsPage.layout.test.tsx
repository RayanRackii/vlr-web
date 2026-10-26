import { AxiosError } from "axios"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssetsPage } from "@/features/assets/pages/AssetsPage"
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
