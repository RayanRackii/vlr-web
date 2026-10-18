import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
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

const apiGet = vi.mocked(api.get)
const apiDelete = vi.mocked(api.delete)

const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const SCHEDULED_ASSET = {
  id: ASSET_ID,
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
  scheduledDeletionAt: "2026-11-01T00:00:00.000Z",
}

function axiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError("Request failed")
  error.response = {
    status,
    data,
    statusText: "Conflict",
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  } as AxiosResponse
  return error
}

function assetListGets(): number {
  return apiGet.mock.calls.filter((call) => call[0] === "/api/assets").length
}

describe("AssetsPage permanent delete", () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiDelete.mockReset()
    apiGet.mockImplementation(async (url: string) => {
      if (url === "/api/assets") {
        return { data: [SCHEDULED_ASSET], status: 200 }
      }

      throw new AxiosError("Network Error", "ERR_NETWORK")
    })
    apiDelete.mockRejectedValue(
      axiosError(409, {
        error: "Asset is referenced by work orders and cannot be deleted.",
        code: "ASSET_IN_USE",
      }),
    )
  })

  it("keeps the row and shows ASSET_IN_USE when permanent delete is refused", async () => {
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

    expect(await screen.findByText("Q-01")).toBeInTheDocument()
    const getsAfterLoad = assetListGets()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("assets.inventory.actions.rowMenu", { tag: "Q-01" }),
      }),
    )
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("assets.actions.remove"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("assets.deletion.confirm"),
      }),
    )

    const blocked = i18n.t("assets.inventory.errors.deleteBlockedByWorkOrders")
    expect(await screen.findAllByText(blocked)).not.toHaveLength(0)
    expect(apiDelete).toHaveBeenCalledWith(`/api/assets/${ASSET_ID}`)
    expect(screen.getByText("Q-01")).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("assets.deletion.permanentSuccess")),
    ).not.toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    )

    expect(screen.getAllByText(blocked)).toHaveLength(1)
    expect(screen.getByText("Q-01")).toBeInTheDocument()
    expect(assetListGets()).toBe(getsAfterLoad)
  })
})
