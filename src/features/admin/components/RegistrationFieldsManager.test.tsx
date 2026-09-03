import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RegistrationFieldsManager } from "@/features/admin/components/RegistrationFieldsManager"
import { TenantRegistrationFieldsPage } from "@/features/admin/pages/TenantRegistrationFieldsPage"
import type { RegistrationField } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createRegistrationField,
  deleteRegistrationField,
  listTenantRegistrationFields,
  updateRegistrationField,
} from "@/features/tenantPortal/services/tenantPortalService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  listTenantRegistrationFields: vi.fn(),
  listAdminRegistrationFields: vi.fn(),
  createRegistrationField: vi.fn(),
  updateRegistrationField: vi.fn(),
  deleteRegistrationField: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const REQUIRED_FIELD: RegistrationField = {
  id: "11111111-1111-4111-8111-111111111111",
  fieldKey: "dataNascimento",
  label: "Data de nascimento",
  fieldType: "date",
  isRequired: true,
  sortOrder: 0,
  options: null,
}

const OPTIONAL_FIELD: RegistrationField = {
  id: "22222222-2222-4222-8222-222222222222",
  fieldKey: "temBagagem",
  label: "Tem bagagem",
  fieldType: "boolean",
  isRequired: false,
  sortOrder: 1,
  options: null,
}

const WRITE_PERMS = ["core.registration_fields.write"] as const

const listMock = vi.mocked(listTenantRegistrationFields)
const createMock = vi.mocked(createRegistrationField)
const updateMock = vi.mocked(updateRegistrationField)
const deleteMock = vi.mocked(deleteRegistrationField)

function renderManager(
  permissions: readonly string[] = WRITE_PERMS,
) {
  return render(
    <TestPermissionProvider permissions={permissions}>
      <RegistrationFieldsManager />
    </TestPermissionProvider>,
  )
}

async function waitForListLoaded() {
  await waitFor(() => {
    expect(listMock).toHaveBeenCalled()
  })
  await waitFor(() => {
    expect(
      screen.getByText(i18n.t("admin.registrationFields.builtIn.title")),
    ).toBeInTheDocument()
  })
}

function builtInList() {
  const heading = screen.getByRole("heading", {
    name: i18n.t("admin.registrationFields.builtIn.title"),
  })
  const section = heading.closest("section")
  if (!section) {
    throw new Error("Built-in fields section was not rendered.")
  }
  return section
}

function customList() {
  const heading = screen.getByRole("heading", {
    name: i18n.t("admin.registrationFields.custom.title"),
  })
  const section = heading.closest("section")
  if (!section) {
    throw new Error("Custom fields section was not rendered.")
  }
  return section
}

describe("RegistrationFieldsManager", () => {
  beforeEach(() => {
    listMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    listMock.mockResolvedValue([])
    createMock.mockResolvedValue(REQUIRED_FIELD)
    updateMock.mockResolvedValue(REQUIRED_FIELD)
    deleteMock.mockResolvedValue(undefined)
  })

  it("renders the seven built-in fields as required and without delete", async () => {
    renderManager()
    await waitForListLoaded()

    const builtIn = builtInList()
    const labels = [
      i18n.t("tenantPortal.fields.name"),
      i18n.t("tenantPortal.fields.email"),
      i18n.t("tenantPortal.fields.password"),
      i18n.t("tenantPortal.fields.confirmPassword"),
      i18n.t("tenantPortal.fields.phone"),
      i18n.t("tenantPortal.fields.customerType"),
      i18n.t("admin.registrationFields.builtIn.document"),
    ]

    for (const label of labels) {
      expect(within(builtIn).getByText(label)).toBeInTheDocument()
    }

    expect(
      within(builtIn).getAllByText(i18n.t("admin.registrationFields.required")),
    ).toHaveLength(7)
    expect(
      within(builtIn).queryByRole("button", { name: i18n.t("common.delete") }),
    ).not.toBeInTheDocument()
    expect(within(builtIn).queryByText("name")).not.toBeInTheDocument()
    expect(within(builtIn).queryByText("confirmPassword")).not.toBeInTheDocument()
  })

  it("shows required vs optional badges on saved custom fields", async () => {
    listMock.mockResolvedValue([REQUIRED_FIELD, OPTIONAL_FIELD])
    renderManager()
    await waitForListLoaded()

    const custom = customList()
    const requiredRow = within(custom)
      .getByText(REQUIRED_FIELD.label)
      .closest("li")
    const optionalRow = within(custom)
      .getByText(OPTIONAL_FIELD.label)
      .closest("li")

    if (!requiredRow || !optionalRow) {
      throw new Error("Custom field rows were not rendered.")
    }

    expect(
      within(requiredRow).getByText(i18n.t("admin.registrationFields.required")),
    ).toBeInTheDocument()
    expect(
      within(optionalRow).getByText(i18n.t("admin.registrationFields.optional")),
    ).toBeInTheDocument()
    expect(
      within(requiredRow).getByText(i18n.t("admin.registrationFields.types.date")),
    ).toBeInTheDocument()
    expect(
      within(optionalRow).getByText(
        i18n.t("admin.registrationFields.types.boolean"),
      ),
    ).toBeInTheDocument()
  })

  it("shows translated type labels in the editor and persists phone as the enum value", async () => {
    const user = userEvent.setup()
    renderManager()
    await waitForListLoaded()

    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.registrationFields.add") }),
    )

    const dialog = await screen.findByRole("dialog")
    const typeSelect = within(dialog).getByLabelText(
      i18n.t("admin.registrationFields.fieldType"),
    )

    expect(typeSelect).toHaveDisplayValue(
      i18n.t("admin.registrationFields.types.text"),
    )
    expect(
      within(typeSelect).getByRole("option", {
        name: i18n.t("admin.registrationFields.types.phone"),
      }),
    ).toHaveValue("phone")
    expect(
      within(typeSelect).queryByRole("option", { name: "phone" }),
    ).not.toBeInTheDocument()

    await user.type(
      within(dialog).getByLabelText(i18n.t("admin.registrationFields.label")),
      "Celular comercial",
    )
    await user.selectOptions(typeSelect, "phone")
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.registrationFields.save"),
      }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        {
          fieldKey: "celularComercial",
          label: "Celular comercial",
          fieldType: "phone",
          isRequired: false,
          sortOrder: 0,
          options: null,
        },
        undefined,
      )
    })
  })

  it("persists Sim / Não as boolean", async () => {
    const user = userEvent.setup()
    renderManager()
    await waitForListLoaded()

    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.registrationFields.add") }),
    )

    const dialog = await screen.findByRole("dialog")
    await user.type(
      within(dialog).getByLabelText(i18n.t("admin.registrationFields.label")),
      "Tem bagagem",
    )
    await user.selectOptions(
      within(dialog).getByLabelText(i18n.t("admin.registrationFields.fieldType")),
      "boolean",
    )
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.registrationFields.save"),
      }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldKey: "temBagagem",
          fieldType: "boolean",
        }),
        undefined,
      )
    })
  })

  it("creates a field with a derived key and enum type", async () => {
    const user = userEvent.setup()
    const created: RegistrationField = {
      id: "33333333-3333-4333-8333-333333333333",
      fieldKey: "dataNascimento",
      label: "Data de nascimento",
      fieldType: "date",
      isRequired: true,
      sortOrder: 0,
      options: null,
    }
    createMock.mockResolvedValue(created)
    listMock.mockResolvedValueOnce([]).mockResolvedValueOnce([created])

    renderManager()
    await waitForListLoaded()

    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.registrationFields.add") }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText(i18n.t("admin.registrationFields.createTitle")),
    ).toBeInTheDocument()

    await user.type(
      within(dialog).getByLabelText(i18n.t("admin.registrationFields.label")),
      "Data de nascimento",
    )
    await user.selectOptions(
      within(dialog).getByLabelText(i18n.t("admin.registrationFields.fieldType")),
      "date",
    )
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: i18n.t("admin.registrationFields.requiredCheckbox"),
      }),
    )
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.registrationFields.save"),
      }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        {
          fieldKey: "dataNascimento",
          label: "Data de nascimento",
          fieldType: "date",
          isRequired: true,
          sortOrder: 0,
          options: null,
        },
        undefined,
      )
    })

    expect(
      await screen.findByText(created.label),
    ).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("updates a field without sending or changing fieldKey", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OPTIONAL_FIELD])
    const updated: RegistrationField = {
      ...OPTIONAL_FIELD,
      label: "Possui bagagem",
      isRequired: true,
    }
    updateMock.mockResolvedValue(updated)
    listMock.mockResolvedValueOnce([OPTIONAL_FIELD]).mockResolvedValueOnce([updated])

    renderManager()
    await waitForListLoaded()

    const row = screen.getByText(OPTIONAL_FIELD.label).closest("li")
    if (!row) {
      throw new Error("Custom field row was not rendered.")
    }

    await user.click(
      within(row).getByRole("button", { name: i18n.t("common.edit") }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText(i18n.t("admin.registrationFields.editTitle")),
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByText(/temBagagem/),
    ).not.toBeInTheDocument()

    const labelInput = within(dialog).getByLabelText(
      i18n.t("admin.registrationFields.label"),
    )
    await user.clear(labelInput)
    await user.type(labelInput, "Possui bagagem")
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: i18n.t("admin.registrationFields.requiredCheckbox"),
      }),
    )
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.registrationFields.save"),
      }),
    )

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1)
    })

    const [fieldId, body, tenantId] = updateMock.mock.calls[0] ?? []
    expect(fieldId).toBe(OPTIONAL_FIELD.id)
    expect(tenantId).toBeUndefined()
    expect(body).toEqual({
      label: "Possui bagagem",
      fieldType: "boolean",
      isRequired: true,
      sortOrder: OPTIONAL_FIELD.sortOrder,
      options: null,
    })
    expect(body).not.toHaveProperty("fieldKey")
  })

  it("deletes a custom field after confirm", async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([OPTIONAL_FIELD])
    listMock.mockResolvedValueOnce([OPTIONAL_FIELD]).mockResolvedValueOnce([])

    renderManager()
    await waitForListLoaded()

    const row = screen.getByText(OPTIONAL_FIELD.label).closest("li")
    if (!row) {
      throw new Error("Custom field row was not rendered.")
    }

    await user.click(
      within(row).getByRole("button", { name: i18n.t("common.delete") }),
    )

    const confirm = await screen.findByRole("alertdialog")
    await user.click(
      within(confirm).getByRole("button", { name: i18n.t("common.delete") }),
    )

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith(OPTIONAL_FIELD.id, undefined)
    })
  })
})

describe("TenantRegistrationFieldsPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    listMock.mockResolvedValue([])
  })

  it("uses the PeopleAccess shell with the registration form title", async () => {
    const { container } = render(
      <TestPermissionProvider permissions={WRITE_PERMS}>
        <TenantRegistrationFieldsPage />
      </TestPermissionProvider>,
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: i18n.t("admin.registrationFields.tenantPageTitle"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.registrationFields.tenantPageDescription")),
    ).toBeInTheDocument()
    expect(container.firstChild).toHaveClass(
      "mx-auto",
      "w-full",
      "max-w-6xl",
      "space-y-6",
    )
    expect(container.firstChild).not.toHaveClass("p-6")
  })
})
