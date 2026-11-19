import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

import { AdminAssetFamiliesPage } from "@/features/admin/pages/AdminAssetFamiliesPage"
import type {
  AdminAssetFamily,
  AdminAssetFamilySchemaPreview,
} from "@/features/admin/schemas/adminAssetFamilySchemas"
import {
  AdminAssetFamilyConflictError,
  createAdminAssetFamily,
  deleteAdminAssetFamily,
  getAdminAssetFamily,
  listAdminAssetFamilies,
  previewAdminAssetFamilySchema,
  updateAdminAssetFamily,
} from "@/features/admin/services/adminAssetFamiliesService"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/services/adminAssetFamiliesService", () => ({
  AdminAssetFamilyConflictError: class AdminAssetFamilyConflictError extends Error {},
  listAdminAssetFamilies: vi.fn(),
  getAdminAssetFamily: vi.fn(),
  createAdminAssetFamily: vi.fn(),
  updateAdminAssetFamily: vi.fn(),
  previewAdminAssetFamilySchema: vi.fn(),
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
  schemaVersion: 1,
}

const courts: AdminAssetFamily = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "quadras",
  label: "Quadras",
  fields: [{ key: "covered", type: "boolean", required: false, label: null }],
  sortOrder: 3,
  isActive: true,
  schemaVersion: 3,
}

const archived: AdminAssetFamily = {
  id: "33333333-3333-4333-8333-333333333333",
  key: "arquivo",
  label: "Arquivo",
  fields: [],
  sortOrder: 9,
  isActive: false,
  schemaVersion: 1,
}

const listMock = vi.mocked(listAdminAssetFamilies)
const getMock = vi.mocked(getAdminAssetFamily)
const createMock = vi.mocked(createAdminAssetFamily)
const updateMock = vi.mocked(updateAdminAssetFamily)
const deleteMock = vi.mocked(deleteAdminAssetFamily)
const previewMock = vi.mocked(previewAdminAssetFamilySchema)

const quietPreview: AdminAssetFamilySchemaPreview = {
  schemaVersion: 3,
  assetCount: 0,
  tenantCount: 0,
  canSave: true,
  fields: [],
}

const emptyProps = {
  help: null, unit: null, min: null, max: null, decimals: null,
  options: null, maxLength: null, group: null, archived: false,
}

/** The data table is duplicated as mobile cards below md; scope text queries to the table to avoid ambiguous matches. */
function table() {
  return screen.getByRole("table")
}

/** The table only exists once loading finishes, so wait for it before scoping. */
async function findInTable(text: string) {
  return within(await screen.findByRole("table")).findByText(text)
}

async function renderLoaded() {
  render(<AdminAssetFamiliesPage />)
  await findInTable("Quadras")
}

describe("AdminAssetFamiliesPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    getMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    previewMock.mockReset()
    previewMock.mockResolvedValue(quietPreview)
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
    expect(within(table()).getByText("Espaços")).toBeInTheDocument()
    expect(within(table()).queryByText("Arquivo")).not.toBeInTheDocument()
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

    await findInTable("Arquivo")
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
          { key: "area", type: "text", required: false, label: null, ...emptyProps },
          { key: "covered", type: "text", required: false, label: null, ...emptyProps },
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
        expectedSchemaVersion: 3,
        fields: [
          { key: "covered", type: "boolean", required: false, label: null, ...emptyProps },
        ],
      })
    })
    expect(updateMock.mock.calls[0]?.[1]).not.toHaveProperty("key")
    expect(previewMock).toHaveBeenCalledWith(courts.id, {
      fields: [
        { key: "covered", type: "boolean", required: false, label: null, ...emptyProps },
      ],
    })
  })

  const v2Family: AdminAssetFamily = {
    ...courts,
    schemaVersion: 7,
    fields: [
      {
        key: "build_x_mm", type: "number", required: false, label: "Volume X",
        help: null, unit: "mm", min: 0, max: null, decimals: 1, options: null,
        maxLength: null, group: "Volume", archived: false,
      },
      {
        key: "materials", type: "multiselect", required: false, label: "Materiais",
        help: null, unit: null, min: null, max: null, decimals: null,
        options: ["PLA", "PETG"], maxLength: null, group: null, archived: false,
      },
      {
        key: "legacy", type: "text", required: false, label: "Antigo",
        help: null, unit: null, min: null, max: null, decimals: null, options: null,
        maxLength: null, group: null, archived: true,
      },
    ],
  }

  async function openEditor(family: AdminAssetFamily = courts) {
    const user = userEvent.setup()
    getMock.mockResolvedValue(family)
    await renderLoaded()
    await user.click(
      within(screen.getByRole("row", { name: /Quadras/ })).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.edit"),
      }),
    )
    const dialog = await screen.findByRole("dialog")
    return { user, dialog }
  }

  async function save(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.save"),
      }),
    )
  }

  it("edits a v2 family without any read-only guard and keeps every property", async () => {
    updateMock.mockResolvedValue(v2Family)
    const { user, dialog } = await openEditor(v2Family)

    expect(
      within(dialog).queryByText(/o editor ainda n/i),
    ).not.toBeInTheDocument()
    expect(within(dialog).getByDisplayValue("mm")).toBeInTheDocument()
    expect(within(dialog).getAllByDisplayValue("PLA").length).toBeGreaterThan(0)

    await save(user, dialog)

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    const sent = updateMock.mock.calls[0]?.[1]
    expect(sent?.expectedSchemaVersion).toBe(7)
    expect(sent?.fields).toEqual([
      { ...emptyProps, key: "build_x_mm", type: "number", required: false, label: "Volume X", unit: "mm", min: 0, max: null, decimals: 1, group: "Volume" },
      { ...emptyProps, key: "materials", type: "multiselect", required: false, label: "Materiais", options: ["PLA", "PETG"] },
      { ...emptyProps, key: "legacy", type: "text", required: false, label: "Antigo", archived: true },
    ])
  })

  it("locks the key of an existing field but not of a new one", async () => {
    const { user, dialog } = await openEditor(v2Family)
    const keys = within(dialog).getAllByLabelText(
      i18n.t("admin.assetFamilies.form.fieldKey"),
    )
    expect(keys).toHaveLength(2)
    expect(keys.every((input) => (input as HTMLInputElement).disabled)).toBe(true)

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.form.addField"),
      }),
    )
    const after = within(dialog).getAllByLabelText(
      i18n.t("admin.assetFamilies.form.fieldKey"),
    )
    expect((after[2] as HTMLInputElement).disabled).toBe(false)
  })

  it("edits the number properties and the max length of a field", async () => {
    updateMock.mockResolvedValue(courts)
    const { user, dialog } = await openEditor({
      ...courts,
      fields: [
        { key: "area", type: "number", required: false, label: null },
        { key: "name", type: "text", required: false, label: null },
      ],
    })

    await user.type(within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.unit")), "m2")
    await user.type(within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.min")), "0")
    await user.type(within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.max")), "99,5")
    await user.type(within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.decimals")), "2")
    await user.type(within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.maxLength")), "80")
    await user.type(within(dialog).getAllByLabelText(i18n.t("admin.assetFamilies.form.group"))[0]!, "Medidas")
    await user.type(within(dialog).getAllByLabelText(i18n.t("admin.assetFamilies.form.help"))[0]!, "Em metros")

    await save(user, dialog)

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0]?.[1].fields).toEqual([
      { ...emptyProps, key: "area", type: "number", required: false, label: null, unit: "m2", min: 0, max: 99.5, decimals: 2, group: "Medidas", help: "Em metros" },
      { ...emptyProps, key: "name", type: "text", required: false, label: null, maxLength: 80 },
    ])
  })

  it("shows the options editor when choosing multiselect and sends the options", async () => {
    updateMock.mockResolvedValue(courts)
    const { user, dialog } = await openEditor()

    expect(
      within(dialog).queryByRole("button", {
        name: i18n.t("admin.assetFamilies.form.addOption"),
      }),
    ).not.toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("combobox", {
        name: i18n.t("admin.assetFamilies.form.fieldType"),
      }),
    )
    await user.click(
      await screen.findByRole("option", {
        name: i18n.t("admin.assetFamilies.types.multiselect"),
      }),
    )

    await user.click(
      await within(dialog).findByRole("button", {
        name: i18n.t("admin.assetFamilies.form.addOption"),
      }),
    )
    await user.type(
      within(dialog).getByLabelText(
        i18n.t("admin.assetFamilies.form.optionItem", { number: 1 }),
      ),
      "PLA",
    )
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.form.addOption"),
      }),
    )
    await user.type(
      within(dialog).getByLabelText(
        i18n.t("admin.assetFamilies.form.optionItem", { number: 2 }),
      ),
      "PETG",
    )

    await save(user, dialog)

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0]?.[1].fields[0]).toMatchObject({
      key: "covered",
      type: "multiselect",
      options: ["PLA", "PETG"],
    })
  })

  it("archives an existing field, lists it as archived and restores it", async () => {
    updateMock.mockResolvedValue(courts)
    const { user, dialog } = await openEditor()

    await user.click(
      within(dialog).getByRole("button", {
        name: new RegExp(i18n.t("admin.assetFamilies.form.archive")),
      }),
    )
    expect(
      within(dialog).getByText(i18n.t("admin.assetFamilies.form.archivedBadge")),
    ).toBeInTheDocument()

    await save(user, dialog)
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock.mock.calls[0]?.[1].fields).toEqual([
      expect.objectContaining({ key: "covered", archived: true, required: false }),
    ])
  })

  it("restores an archived field and sends archived false", async () => {
    updateMock.mockResolvedValue(v2Family)
    const { user, dialog } = await openEditor(v2Family)

    await user.click(
      within(dialog).getByRole("button", {
        name: new RegExp(i18n.t("admin.assetFamilies.form.restore")),
      }),
    )
    await save(user, dialog)

    await waitFor(() => expect(updateMock).toHaveBeenCalled())
    expect(updateMock.mock.calls[0]?.[1].fields.at(-1)).toMatchObject({
      key: "legacy",
      archived: false,
    })
  })

  it("blocks the save and lists the incompatible samples when the preview blocks", async () => {
    previewMock.mockResolvedValue({
      schemaVersion: 3,
      assetCount: 4,
      tenantCount: 2,
      canSave: false,
      fields: [
        {
          key: "covered",
          change: "typeChanged",
          assetCount: 4,
          tenantCount: 2,
          incompatibleCount: 3,
          incompatibleSamples: ["PLA especial", "abc"],
          constraintViolationCount: 0,
          blocking: true,
        },
      ],
    })
    const { user, dialog } = await openEditor()

    await save(user, dialog)

    expect(
      await within(dialog).findByText(i18n.t("admin.assetFamilies.impact.blockedTitle")),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/"PLA especial", "abc"/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        i18n.t("admin.assetFamilies.impact.incompatible", { count: 3 }),
        { exact: false },
      ),
    ).toBeInTheDocument()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("asks for confirmation with the usage summary before an impactful save", async () => {
    previewMock.mockResolvedValue({
      schemaVersion: 3,
      assetCount: 5,
      tenantCount: 2,
      canSave: true,
      fields: [
        {
          key: "covered",
          change: "archived",
          assetCount: 5,
          tenantCount: 2,
          incompatibleCount: 0,
          incompatibleSamples: [],
          constraintViolationCount: 1,
          blocking: false,
        },
      ],
    })
    updateMock.mockResolvedValue(courts)
    const { user, dialog } = await openEditor()

    await save(user, dialog)

    const confirm = await screen.findByRole("alertdialog")
    expect(updateMock).not.toHaveBeenCalled()
    expect(
      within(confirm).getByText(
        i18n.t("admin.assetFamilies.impact.usage", { count: 5, tenants: 2 }),
      ),
    ).toBeInTheDocument()
    expect(
      within(confirm).getByText(
        i18n.t("admin.assetFamilies.impact.constraintViolations", { count: 1 }),
      ),
    ).toBeInTheDocument()

    await user.click(
      within(confirm).getByRole("button", {
        name: i18n.t("admin.assetFamilies.impact.confirm"),
      }),
    )

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock.mock.calls[0]?.[1].expectedSchemaVersion).toBe(3)
  })

  it("does not save when the confirmation is cancelled", async () => {
    previewMock.mockResolvedValue({
      ...quietPreview,
      fields: [
        {
          key: "covered", change: "typeChanged", assetCount: 1, tenantCount: 1,
          incompatibleCount: 0, incompatibleSamples: [], constraintViolationCount: 0,
          blocking: false,
        },
      ],
    })
    const { user, dialog } = await openEditor()

    await save(user, dialog)
    const confirm = await screen.findByRole("alertdialog")
    await user.click(within(confirm).getByRole("button", { name: i18n.t("common.cancel") }))

    expect(updateMock).not.toHaveBeenCalled()
  })

  it("shows the API message on a 409 and reloads the family on request", async () => {
    updateMock.mockRejectedValue(
      new AdminAssetFamilyConflictError(
        "Asset family schema changed since it was loaded (current version 4).",
      ),
    )
    const { user, dialog } = await openEditor()

    await save(user, dialog)

    expect(
      await within(dialog).findByText(
        "Asset family schema changed since it was loaded (current version 4).",
      ),
    ).toBeInTheDocument()

    getMock.mockClear()
    getMock.mockResolvedValue({ ...courts, schemaVersion: 4, label: "Quadras v4" })
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.reload"),
      }),
    )

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(courts.id))
    await waitFor(() =>
      expect(
        within(dialog).getByLabelText(i18n.t("admin.assetFamilies.form.label")),
      ).toHaveValue("Quadras v4"),
    )
    expect(
      within(dialog).queryByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.reload"),
      }),
    ).not.toBeInTheDocument()
  })

  it("does not offer a reload for a non-conflict error", async () => {
    updateMock.mockRejectedValue(new Error("boom"))
    const { user, dialog } = await openEditor()

    await save(user, dialog)

    expect(await within(dialog).findByText("boom")).toBeInTheDocument()
    expect(
      within(dialog).queryByRole("button", {
        name: i18n.t("admin.assetFamilies.actions.reload"),
      }),
    ).not.toBeInTheDocument()
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

  it("renders the title as the single h1", async () => {
    await renderLoaded()

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: i18n.t("admin.assetFamilies.title"),
      }),
    ).toBeInTheDocument()
  })

  const dozen: AdminAssetFamily = {
    ...courts,
    id: "44444444-4444-4444-8444-444444444444",
    key: "doze",
    label: "Doze",
    sortOrder: 12,
    isActive: false,
  }

  function searchBox() {
    return screen.getByRole("searchbox", {
      name: i18n.t("admin.assetFamilies.filters.searchLabel"),
    })
  }

  async function renderThree() {
    listMock.mockResolvedValue([spaces, courts, dozen])
    render(<AdminAssetFamiliesPage />)
    await findInTable("Doze")
  }

  it("searches by key or label and clears with the chip", async () => {
    const user = userEvent.setup()
    await renderThree()

    await user.type(searchBox(), "QUAD")
    expect(within(table()).getByText("Quadras")).toBeInTheDocument()
    expect(within(table()).queryByText("Espaços")).not.toBeInTheDocument()
    expect(within(table()).queryByText("Doze")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /: QUAD$/ }))
    expect(searchBox()).toHaveValue("")
    expect(within(table()).getByText("Doze")).toBeInTheDocument()
    expect(within(table()).getByText("Espaços")).toBeInTheDocument()

    await user.type(searchBox(), "doz")
    expect(within(table()).getByText("Doze")).toBeInTheDocument()
    expect(within(table()).queryByText("Quadras")).not.toBeInTheDocument()

    await user.clear(searchBox())
    await user.type(searchBox(), "espa")
    expect(within(table()).getByText("Espaços")).toBeInTheDocument()
    expect(within(table()).queryByText("Doze")).not.toBeInTheDocument()
  })

  it("narrows by status chips and clears the status chip", async () => {
    const user = userEvent.setup()
    await renderThree()

    const group = screen.getByRole("group", {
      name: i18n.t("admin.assetFamilies.filters.statusLabel"),
    })
    const all = within(group).getByRole("button", {
      name: i18n.t("admin.assetFamilies.filters.all"),
    })
    expect(all).toHaveAttribute("aria-pressed", "true")

    await user.click(
      within(group).getByRole("button", {
        name: i18n.t("admin.assetFamilies.statusInactive"),
      }),
    )
    expect(within(table()).getByText("Doze")).toBeInTheDocument()
    expect(within(table()).queryByText("Quadras")).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: `${i18n.t("admin.assetFamilies.filters.statusLabel")}: ${i18n.t("admin.assetFamilies.statusInactive")}`,
      }),
    )
    expect(all).toHaveAttribute("aria-pressed", "true")
    expect(within(table()).getByText("Quadras")).toBeInTheDocument()

    await user.click(
      within(group).getByRole("button", {
        name: i18n.t("admin.assetFamilies.statusActive"),
      }),
    )
    expect(within(table()).getByText("Quadras")).toBeInTheDocument()
    expect(within(table()).queryByText("Doze")).not.toBeInTheDocument()
  })

  it("shows the empty state when no family matches", async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.type(searchBox(), "zzz")

    expect(
      await screen.findByText(i18n.t("admin.assetFamilies.emptyTitle")),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows the load error and retries", async () => {
    const user = userEvent.setup()
    listMock.mockRejectedValueOnce(new Error("boom"))
    render(<AdminAssetFamiliesPage />)

    const retry = await screen.findByRole("button", {
      name: i18n.t("admin.assetFamilies.actions.retry"),
    })
    await user.click(retry)

    await findInTable("Quadras")
    expect(listMock).toHaveBeenCalledTimes(2)
  })
})
