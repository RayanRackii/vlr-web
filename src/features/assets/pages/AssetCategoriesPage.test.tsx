import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AssetCategoriesPage } from "@/features/assets/pages/AssetCategoriesPage"
import type { AssetCategory } from "@/features/assets/schemas/assetCategorySchemas"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/contexts/AuthContext", () => {
  const session = { access_token: "test" }
  return {
    useAuth: () => ({ session }),
    AuthProvider: ({ children }: { children: ReactNode }) => children,
  }
})

vi.mock("@/features/users/services/usersService", () => ({
  getCurrentUser: vi.fn(async () => ({
    fullName: "Teste",
    email: "teste@example.com",
    role: "ADMIN",
    activeModules: ["rentals"],
    activeAssetFamilies: ["spaces"],
  })),
}))

vi.mock("@/features/assets/services/assetCategoriesService", () => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

import {
  createCategory,
  getCategories,
  updateCategory,
} from "@/features/assets/services/assetCategoriesService"

const getCategoriesMock = vi.mocked(getCategories)
const createCategoryMock = vi.mocked(createCategory)
const updateCategoryMock = vi.mocked(updateCategory)

const CATEGORY: AssetCategory = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Quadra",
  manufacturer: "Rolvix",
  description: "Tênis",
  createdAt: "2026-10-14T00:00:00.000Z",
  updatedAt: null,
  scheduledDeletionAt: null,
  linkedAssetsCount: 0,
}

describe("AssetCategoriesPage validity gate", () => {
  beforeEach(() => {
    getCategoriesMock.mockReset()
    createCategoryMock.mockReset()
    updateCategoryMock.mockReset()
    getCategoriesMock.mockResolvedValue([])
  })

  function renderPage(permissions: readonly string[] = [
    "inventory.categories.read",
    "inventory.categories.write",
  ]) {
    return render(
      <TestPermissionProvider
        permissions={permissions}
        activeModules={["inventory"]}
      >
        <AssetCategoriesPage />
      </TestPermissionProvider>,
    )
  }

  async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("assets.categories.actions.new"),
      }),
    )
    return screen.findByRole("dialog")
  }

  it("keeps Salvar disabled until the name passes the schema and leaves Cancelar free", async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openCreateDialog(user)

    const save = within(dialog).getByRole("button", {
      name: i18n.t("assets.categories.actions.save"),
    })
    const cancel = within(dialog).getByRole("button", {
      name: i18n.t("common.cancel"),
    })
    expect(save).toBeDisabled()
    expect(cancel).toBeEnabled()

    const name = within(dialog).getByLabelText(
      i18n.t("assets.categories.form.name"),
    )
    await user.type(name, "   ")
    expect(save).toBeDisabled()
    expect(createCategoryMock).not.toHaveBeenCalled()

    await user.clear(name)
    await user.type(name, "Quadra")
    expect(save).toBeEnabled()
    expect(cancel).toBeEnabled()

    await user.clear(name)
    expect(save).toBeDisabled()
    expect(cancel).toBeEnabled()
    expect(createCategoryMock).not.toHaveBeenCalled()
  })

  it("re-enables Salvar after a server error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createCategoryMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject
        }),
    )
    renderPage()
    const dialog = await openCreateDialog(user)

    const name = within(dialog).getByLabelText(
      i18n.t("assets.categories.form.name"),
    )
    const manufacturer = within(dialog).getByLabelText(
      i18n.t("assets.categories.form.manufacturer"),
    )
    await user.type(name, "Quadra")
    await user.type(manufacturer, "Daikin")

    const save = within(dialog).getByRole("button", {
      name: i18n.t("assets.categories.actions.save"),
    })
    expect(save).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    await user.click(save)

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("assets.categories.actions.saving"),
        }),
      ).toBeDisabled()
    })

    rejectCreate(new Error("Nome já cadastrado."))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Nome já cadastrado.",
    )
    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("assets.categories.actions.save"),
        }),
      ).toBeEnabled()
    })
    expect(name).toHaveValue("Quadra")
    expect(manufacturer).toHaveValue("Daikin")
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    expect(
      screen.queryByText(i18n.t("assets.categories.success.created")),
    ).not.toBeInTheDocument()
    expect(createCategoryMock).toHaveBeenCalledTimes(1)
    expect(createCategoryMock).toHaveBeenCalledWith({
      name: "Quadra",
      manufacturer: "Daikin",
      description: undefined,
    })

    createCategoryMock.mockResolvedValueOnce(CATEGORY)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("assets.categories.actions.save"),
      }),
    )
    expect(
      await screen.findByText(i18n.t("assets.categories.success.created")),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(createCategoryMock).toHaveBeenCalledTimes(2)
  })

  it("keeps Salvar disabled when editing until the name is valid again", async () => {
    getCategoriesMock.mockResolvedValue([CATEGORY])
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("Quadra")).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("assets.categories.actions.openMenu"),
      }),
    )
    await user.click(
      await screen.findByRole("menuitem", {
        name: i18n.t("assets.categories.actions.edit"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const save = within(dialog).getByRole("button", {
      name: i18n.t("assets.categories.actions.save"),
    })
    const cancel = within(dialog).getByRole("button", {
      name: i18n.t("common.cancel"),
    })
    const name = within(dialog).getByLabelText(
      i18n.t("assets.categories.form.name"),
    )
    expect(name).toHaveValue("Quadra")
    expect(save).toBeEnabled()
    expect(cancel).toBeEnabled()

    await user.clear(name)
    expect(save).toBeDisabled()
    await user.type(name, "   ")
    expect(save).toBeDisabled()
    expect(updateCategoryMock).not.toHaveBeenCalled()

    await user.clear(name)
    await user.type(name, "Quadra coberta")
    expect(save).toBeEnabled()
    expect(cancel).toBeEnabled()
  })

  it("hides create and row actions without categories.write", async () => {
    getCategoriesMock.mockResolvedValue([CATEGORY])
    renderPage(["inventory.categories.read"])

    expect(await screen.findByText("Quadra")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("assets.categories.actions.new"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("assets.categories.actions.openMenu"),
      }),
    ).not.toBeInTheDocument()
  })
})
