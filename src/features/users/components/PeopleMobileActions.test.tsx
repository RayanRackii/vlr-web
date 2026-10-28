import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PeopleRolesTab } from "./PeopleRolesTab"
import { RegistrationFieldsManager } from "@/features/admin/components/RegistrationFieldsManager"
import type { RegistrationField } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { deleteRegistrationField, listTenantRegistrationFields } from "@/features/tenantPortal/services/tenantPortalService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import type { RoleResponse } from "@/features/users/schemas/roleSchemas"
import { deleteRole } from "@/features/users/services/rolesService"

vi.mock("@/features/users/services/rolesService", () => ({
  createRole: vi.fn(),
  patchRole: vi.fn(),
  replaceRolePermissions: vi.fn(),
  deleteRole: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", () => ({
  listTenantRegistrationFields: vi.fn(),
  listAdminRegistrationFields: vi.fn(),
  createRegistrationField: vi.fn(),
  updateRegistrationField: vi.fn(),
  deleteRegistrationField: vi.fn(),
}))

const customRole: RoleResponse = {
  id: "reception",
  name: "Recepção",
  description: "Balcão",
  isSystemRole: false,
  permissionKeys: [],
}

const customField: RegistrationField = {
  id: "birth-date",
  fieldKey: "dataNascimento",
  label: "Data de nascimento",
  fieldType: "date",
  isRequired: false,
  sortOrder: 0,
  options: null,
}

function setViewport(width: number) {
  vi.stubGlobal("innerWidth", width)
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query === "(max-width: 1023px)" && width < 1024,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

function renderRoles(roles: RoleResponse[] = [customRole]) {
  return render(
    <TestPermissionProvider permissions={["core.roles.read", "core.roles.manage"]}>
      <PeopleRolesTab roles={roles} catalog={[]} onRolesChanged={vi.fn()} />
    </TestPermissionProvider>,
  )
}

describe("People mobile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(deleteRole).mockResolvedValue(undefined)
    vi.mocked(listTenantRegistrationFields).mockResolvedValue([customField])
    vi.mocked(deleteRegistrationField).mockResolvedValue(undefined)
    setViewport(393)
  })

  afterEach(() => vi.unstubAllGlobals())

  it("opens a role's actions from its mobile row and deletes only after confirmation", async () => {
    const user = userEvent.setup()
    renderRoles()

    await user.click(screen.getByRole("button", { name: "Recepção" }))
    const sheet = await screen.findByRole("dialog", { name: "Recepção" })
    expect(sheet).toHaveAttribute("aria-modal", "true")
    expect(within(sheet).getByText("Nome e permissões")).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: /^Excluir/ }))

    const confirm = await screen.findByRole("dialog", { name: "Excluir função" })
    expect(within(confirm).getByText("Excluir a função Recepção? Só é possível se ela não estiver atribuída a ninguém.")).toBeInTheDocument()
    expect(deleteRole).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(deleteRole).toHaveBeenCalledWith("reception"))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it.each(["Admin", "User"])("shows the locked system role %s without a delete action", async (name) => {
    const user = userEvent.setup()
    renderRoles([{ ...customRole, name, isSystemRole: true }])

    await user.click(screen.getByRole("button", { name }))
    const sheet = await screen.findByRole("dialog", { name })
    expect(within(sheet).getByText("Função do sistema: nome fixo")).toBeInTheDocument()
    expect(within(sheet).getByText("Funções de sistema não podem ser excluídas.")).toBeInTheDocument()
    expect(within(sheet).getByRole("button", { name: /^Editar/ })).toBeInTheDocument()
    expect(within(sheet).queryByRole("button", { name: /^Excluir/ })).not.toBeInTheDocument()
    expect(deleteRole).not.toHaveBeenCalled()
  })

  it.each(["{Enter}", " "])("opens from the keyboard with %s, traps focus and returns focus on Escape", async (key) => {
    const user = userEvent.setup()
    renderRoles()
    const row = screen.getByRole("button", { name: "Recepção" })
    row.focus()
    await user.keyboard(key)

    const sheet = await screen.findByRole("dialog", { name: "Recepção" })
    const edit = within(sheet).getByRole("button", { name: /^Editar/ })
    const cancel = within(sheet).getByRole("button", { name: "Cancelar" })
    await waitFor(() => expect(edit).toHaveFocus())
    cancel.focus()
    await user.tab()
    await waitFor(() => expect(edit).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(cancel).toHaveFocus())
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(row).toHaveFocus())
  })

  it("opens custom-field actions on a tablet and reuses the field delete confirmation", async () => {
    setViewport(820)
    const user = userEvent.setup()
    render(<RegistrationFieldsManager canWrite />)
    await user.click(await screen.findByRole("button", { name: "Data de nascimento" }))

    const sheet = await screen.findByRole("dialog", { name: "Data de nascimento" })
    expect(within(sheet).getByText("dataNascimento")).toBeInTheDocument()
    expect(within(sheet).getByText("Rótulo, tipo e obrigatoriedade")).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "Excluir" }))
    const confirm = await screen.findByRole("dialog", { name: "Excluir campo" })
    expect(within(confirm).getByText('Excluir "Data de nascimento" do cadastro do portal?')).toBeInTheDocument()
    expect(deleteRegistrationField).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(deleteRegistrationField).toHaveBeenCalledWith("birth-date", undefined))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("leaves built-in fields without actions", async () => {
    const user = userEvent.setup()
    render(<RegistrationFieldsManager canWrite />)
    await screen.findByRole("button", { name: "Data de nascimento" })
    const row = screen.getByText("E-mail", { exact: true }).closest("li")!
    expect(within(row).queryByRole("button")).not.toBeInTheDocument()
    expect(row).not.toHaveAttribute("tabindex")
    await user.click(row)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not add custom-field actions without write permission", async () => {
    const user = userEvent.setup()
    render(<RegistrationFieldsManager canWrite={false} />)
    const field = await screen.findByText("Data de nascimento")
    expect(within(field.closest("li")!).queryByRole("button")).not.toBeInTheDocument()
    await user.click(field)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("cancels confirmation without deleting and returns focus to the row", async () => {
    const user = userEvent.setup()
    renderRoles()
    const row = screen.getByRole("button", { name: "Recepção" })
    await user.click(row)
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Excluir/ }))
    const confirm = await screen.findByRole("dialog", { name: "Excluir função" })
    expect(within(confirm).getByRole("button", { name: "Cancelar" })).toHaveFocus()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(deleteRole).not.toHaveBeenCalled()
    await waitFor(() => expect(row).toHaveFocus())
  })

  it("keeps direct editing and the original delete dialog at 1024px", async () => {
    setViewport(1024)
    const user = userEvent.setup()
    renderRoles()
    expect(screen.queryByRole("button", { name: "Recepção" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Editar" }))
    expect(await screen.findByRole("dialog", { name: "Perfil de acesso" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Excluir" }))
    expect(await screen.findByRole("alertdialog", { name: "Excluir função" })).toBeInTheDocument()
  })

  it("opens the existing role editor from the sheet and returns focus to the row", async () => {
    const user = userEvent.setup()
    renderRoles()
    const row = screen.getByRole("button", { name: "Recepção" })
    await user.click(row)
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Editar/ }))
    const editor = await screen.findByRole("dialog", { name: "Perfil de acesso" })
    expect(within(editor).getByDisplayValue("Recepção")).toBeInTheDocument()
    await waitFor(() => expect(editor).toContainElement(document.activeElement as HTMLElement))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(row).toHaveFocus())
  })

  it("opens the existing field editor from the sheet and returns focus to the row", async () => {
    const user = userEvent.setup()
    render(<RegistrationFieldsManager canWrite />)
    const row = await screen.findByRole("button", { name: "Data de nascimento" })
    await user.click(row)
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^Editar/ }))
    const editor = await screen.findByRole("dialog", { name: "Editar campo" })
    expect(within(editor).getByDisplayValue("Data de nascimento")).toBeInTheDocument()
    await waitFor(() => expect(editor).toContainElement(document.activeElement as HTMLElement))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(row).toHaveFocus())
  })

  it("closes actions on desktop resize and does not reopen them when returning to mobile", async () => {
    let mobile = true
    const events = new EventTarget()
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() { return query === "(max-width: 1023px)" && mobile },
      media: query,
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    }))
    const user = userEvent.setup()
    renderRoles()
    await user.click(screen.getByRole("button", { name: "Recepção" }))
    expect(await screen.findByRole("dialog", { name: "Recepção" })).toBeInTheDocument()

    act(() => {
      mobile = false
      events.dispatchEvent(new Event("change"))
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    act(() => {
      mobile = true
      events.dispatchEvent(new Event("change"))
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each([
    ["role", "Recepção", "Nova função"],
    ["field", "Data de nascimento", "Adicionar campo"],
  ])("returns focus to creation after using a %s row", async (kind, name, createLabel) => {
    const user = userEvent.setup()
    if (kind === "role") renderRoles()
    else render(<RegistrationFieldsManager canWrite />)
    await user.click(await screen.findByRole("button", { name }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    const create = screen.getByRole("button", { name: createLabel })
    await user.click(create)
    await screen.findByRole("dialog", { name: createLabel })
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(create).toHaveFocus())
  })
})
