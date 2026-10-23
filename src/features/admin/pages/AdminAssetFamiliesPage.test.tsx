import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { AdminAssetFamiliesPage } from "@/features/admin/pages/AdminAssetFamiliesPage"
import type { AdminAssetFamily } from "@/features/admin/schemas/adminAssetFamilySchemas"
import {
  createAdminAssetFamily,
  deleteAdminAssetFamily,
  getAdminAssetFamily,
  listAdminAssetFamilies,
  updateAdminAssetFamily,
} from "@/features/admin/services/adminAssetFamiliesService"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/services/adminAssetFamiliesService", () => ({
  listAdminAssetFamilies: vi.fn(),
  getAdminAssetFamily: vi.fn(),
  createAdminAssetFamily: vi.fn(),
  updateAdminAssetFamily: vi.fn(),
  deleteAdminAssetFamily: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const spaces: AdminAssetFamily = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "spaces",
  label: "Espaços",
  fields: [],
  sortOrder: 0,
  isActive: true,
}

const courts: AdminAssetFamily = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "quadras",
  label: "Quadras",
  fields: [{ key: "covered", type: "boolean", required: false, label: null }],
  sortOrder: 3,
  isActive: true,
}

const archived: AdminAssetFamily = {
  id: "33333333-3333-4333-8333-333333333333",
  key: "arquivo",
  label: "Arquivo",
  fields: [],
  sortOrder: 9,
  isActive: false,
}

const listMock = vi.mocked(listAdminAssetFamilies)
const getMock = vi.mocked(getAdminAssetFamily)
const createMock = vi.mocked(createAdminAssetFamily)
const updateMock = vi.mocked(updateAdminAssetFamily)
const deleteMock = vi.mocked(deleteAdminAssetFamily)

async function renderLoaded() {
  render(<AdminAssetFamiliesPage />)
  await screen.findByText("Quadras")
}

describe("AdminAssetFamiliesPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    getMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()

    listMock.mockImplementation(async (options) =>
      options?.includeInactive ? [spaces, courts, archived] : [spaces, courts],
    )
    getMock.mockImplementation(async (id) => {
      const match = [spaces, courts, archived].find((family) => family.id === id)
      if (!match) {
        throw new Error("missing")
      }
      return match
    })
  })

  it("loads the active catalog and can include inactive families", async () => {
    const user = userEvent.setup()
    await renderLoaded()

    expect(listMock).toHaveBeenCalledWith({ includeInactive: false })
    expect(screen.getByText("Espaços")).toBeInTheDocument()
    expect(screen.queryByText("Arquivo")).not.toBeInTheDocument()
    expect(
      within(screen.getByRole("row", { name: /Espaços/ })).queryByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.deleteNamed", {
          label: "Espaços",
        }),
      }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("switch", {
        name: i18n.t("admin.assetFamilies.includeInactive"),
      }),
    )

    await screen.findByText("Arquivo")
    expect(listMock).toHaveBeenCalledWith({ includeInactive: true })
  })

  it("keeps save disabled until the form matches the API rules, then creates", async () => {
    const user = userEvent.setup()
    createMock.mockResolvedValue(courts)
    await renderLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.create"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const save = within(dialog).getByRole("button", {
      name: i18n.t("admin.assetFamilies.actions.save"),
    })
    expect(save).toBeDisabled()

    await user.type(
      within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.key")),
      "1bad",
    )
    await waitFor(() => expect(save).toBeDisabled(), { timeout: 5000 })

    await user.clear(
      within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.key")),
    )
    await user.type(
      within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.key")),
      "Quadras_Novas",
    )
    await user.type(
      within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.label")),
      "Quadras novas",
    )
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 5000 })

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.form.addField"),
      }),
    )
    const fieldKeys = within(dialog).getAllByLabelText(
      i18n.t("admin.assetFamilies.form.fieldKey"),
    )
    await user.type(fieldKeys[0]!, "area")
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.form.addField"),
      }),
    )
    const fieldKeysAfter = within(dialog).getAllByLabelText(
      i18n.t("admin.assetFamilies.form.fieldKey"),
    )
    await user.type(fieldKeysAfter[1]!, "area")
    await waitFor(() => expect(save).toBeDisabled(), { timeout: 5000 })

    await user.clear(fieldKeysAfter[1]!)
    await user.type(fieldKeysAfter[1]!, "covered")
    await waitFor(() => expect(save).toBeEnabled(), { timeout: 5000 })

    await user.click(save)

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        key: "quadras_novas",
        label: "Quadras novas",
        sortOrder: 0,
        isActive: true,
        fields: [
          { key: "area", type: "text", required: false, label: null },
          { key: "covered", type: "text", required: false, label: null },
        ],
      })
    }, { timeout: 5000 })
    expect(toast.success).toHaveBeenCalledWith(
      i18n.t("admin.assetFamilies.success.created"),
    )
  })

  it("updates label and fields without sending the key", async () => {
    const user = userEvent.setup()
    updateMock.mockResolvedValue({ ...courts, label: "Quadras cobertas" })
    await renderLoaded()

    const row = screen.getByRole("row", { name: /Quadras/ })
    await user.click(
      within(row).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.edit"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const key = within(dialog).getByLabelText(
      i18n.t("admin.assetFamilies.form.key"),
    )
    expect(key).toBeDisabled()
    expect(key).toHaveValue("quadras")

    const label = within(dialog).getByLabelText(
      i18n.t("admin.assetFamilies.form.label"),
    )
    await user.clear(label)
    await user.type(label, "Quadras cobertas")
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.save"),
      }),
    )

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(courts.id, {
        label: "Quadras cobertas",
        sortOrder: 3,
        isActive: true,
        fields: [
          { key: "covered", type: "boolean", required: false, label: null },
        ],
      })
    })
    expect(updateMock.mock.calls[0]?.[1]).not.toHaveProperty("key")
  })

  it("locks deactivation for a seed family", async () => {
    const user = userEvent.setup()
    await renderLoaded()

    const row = screen.getByRole("row", { name: /Espaços/ })
    await user.click(
      within(row).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.edit"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const activeSwitch = within(dialog).getByRole("switch", {
      name: i18n.t("admin.assetFamilies.form.isActive"),
    })
    expect(activeSwitch).toHaveAttribute("aria-disabled", "true")
    await user.click(activeSwitch)
    expect(activeSwitch).toHaveAttribute("aria-checked", "true")
    expect(
      within(dialog).getByText(i18n.t("admin.assetFamilies.form.seedLocked")),
    ).toBeInTheDocument()
  })

  it("keeps the delete dialog open when the family is in use", async () => {
    const user = userEvent.setup()
    deleteMock.mockRejectedValue(
      new Error("Asset family is in use and cannot be deleted."),
    )
    await renderLoaded()

    const row = screen.getByRole("row", { name: /Quadras/ })
    await user.click(
      within(row).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.deleteNamed", {
          label: "Quadras",
        }),
      }),
    )

    const dialog = await screen.findByRole("alertdialog")
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.delete.confirm"),
      }),
    )

    expect(
      await within(dialog).findByText(
        "Asset family is in use and cannot be deleted.",
      ),
    ).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(
      "Asset family is in use and cannot be deleted.",
    )
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("filters the order column by the digits typed, not a numeric range", async () => {
    const user = userEvent.setup()
    const dozen: AdminAssetFamily = {
      ...courts,
      id: "44444444-4444-4444-8444-444444444444",
      key: "doze",
      label: "Doze",
      sortOrder: 12,
    }
    listMock.mockResolvedValue([courts, dozen])

    render(<AdminAssetFamiliesPage />)
    await screen.findByText("Doze")

    const orderHeader = screen.getByRole("columnheader", { name: /Ordem/ })
    await user.click(
      within(orderHeader).getByRole("button", {
        name: i18n.t("common.filter"),
      }),
    )
    await user.type(
      screen.getByPlaceholderText(i18n.t("common.searchPlaceholder")),
      "12",
    )

    expect(screen.getByText("Doze")).toBeInTheDocument()
    expect(screen.queryByText("Quadras")).not.toBeInTheDocument()
  })
})
