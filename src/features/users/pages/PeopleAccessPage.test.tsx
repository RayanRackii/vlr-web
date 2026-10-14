import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { PeopleAccessPage } from "@/features/users/pages/PeopleAccessPage"
import type { RoleResponse } from "@/features/users/schemas/roleSchemas"
import type {
  InviteTenantMemberResponse,
  TenantCustomer,
  TenantMember,
} from "@/features/users/schemas/userSchemas"
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  patchRole,
} from "@/features/users/services/rolesService"
import {
  assignUserRoles,
  inviteTenantMember,
  listTenantCustomers,
  listTenantMembers,
} from "@/features/users/services/usersService"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/services/rolesService", () => ({
  listRoles: vi.fn(),
  listPermissions: vi.fn(),
  createRole: vi.fn(),
  patchRole: vi.fn(),
  replaceRolePermissions: vi.fn(),
  deleteRole: vi.fn(),
}))

vi.mock("@/features/users/services/usersService", () => ({
  listTenantMembers: vi.fn(),
  listTenantCustomers: vi.fn(),
  inviteTenantMember: vi.fn(),
  assignUserRoles: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const ROLE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const INVITE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const CUSTOM_ROLE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const CREATED_ROLE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff"

const ADMIN_ROLE: RoleResponse = {
  id: ROLE_ID,
  name: "Admin",
  description: "Administrador do ambiente",
  isSystemRole: true,
  permissionKeys: ["core.users.read", "core.users.invite"],
}

const MEMBER: TenantMember = {
  id: MEMBER_ID,
  fullName: "Ana Souza",
  email: "ana@example.com",
  isActive: true,
  roles: [
    {
      id: ROLE_ID,
      name: "Admin",
      isSystemRole: true,
    },
  ],
}

const INVITE_RESPONSE: InviteTenantMemberResponse = {
  id: INVITE_ID,
  fullName: "Bruno Lima",
  email: "bruno@example.com",
  roleName: "Admin",
  expiresAt: "2026-09-10T12:00:00.000Z",
}

const CUSTOM_ROLE: RoleResponse = {
  id: CUSTOM_ROLE_ID,
  name: "Recepção",
  description: "Balcão",
  isSystemRole: false,
  permissionKeys: ["core.users.read"],
}

const CREATED_ROLE: RoleResponse = {
  id: CREATED_ROLE_ID,
  name: "Portaria",
  description: null,
  isSystemRole: false,
  permissionKeys: [],
}

const USERS_READ_PERMISSION = {
  key: "core.users.read",
  name: "Ver usuários",
  description: null,
  moduleKey: "core",
  resource: "users",
}

const READ_USERS = ["core.users.read"] as const
const READ_ROLES = ["core.users.read", "core.roles.read"] as const
const INVITE_PERMS = [
  "core.users.read",
  "core.users.invite",
  "core.roles.read",
] as const
const ASSIGN_PERMS = [
  "core.users.read",
  "core.users.assign_roles",
  "core.roles.read",
] as const
const CUSTOMER_PERMS = ["core.users.read", "core.customers.read"] as const
const MANAGE_ROLES = [
  "core.users.read",
  "core.roles.read",
  "core.roles.manage",
] as const

const CUSTOMER: TenantCustomer = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  name: "Cliente Portal",
  email: "cliente@example.com",
  emailVerified: true,
  createdAt: "2026-10-13T15:00:00.000Z",
}

function memberPage(items: TenantMember[]) {
  return { items, page: 1, pageSize: 20, total: items.length }
}

function customerPage(items: TenantCustomer[]) {
  return { items, page: 1, pageSize: 20, total: items.length }
}

const listRolesMock = vi.mocked(listRoles)
const listPermissionsMock = vi.mocked(listPermissions)
const listTenantMembersMock = vi.mocked(listTenantMembers)
const listTenantCustomersMock = vi.mocked(listTenantCustomers)
const inviteTenantMemberMock = vi.mocked(inviteTenantMember)
const assignUserRolesMock = vi.mocked(assignUserRoles)
const createRoleMock = vi.mocked(createRole)
const patchRoleMock = vi.mocked(patchRole)
const deleteRoleMock = vi.mocked(deleteRole)
const toastError = vi.mocked(toast.error)
const toastSuccess = vi.mocked(toast.success)

function renderPage(permissions: readonly string[]) {
  return render(
    <TestPermissionProvider permissions={permissions}>
      <PeopleAccessPage />
    </TestPermissionProvider>,
  )
}

async function waitForUsersLoaded() {
  await waitFor(() => {
    expect(listTenantMembersMock).toHaveBeenCalled()
  })
  await waitFor(() => {
    expect(
      screen.queryByText(i18n.t("peopleAccess.users.description")),
    ).toBeInTheDocument()
  })
}

describe("PeopleAccessPage", () => {
  beforeEach(() => {
    listRolesMock.mockReset()
    listPermissionsMock.mockReset()
    listTenantMembersMock.mockReset()
    listTenantCustomersMock.mockReset()
    inviteTenantMemberMock.mockReset()
    assignUserRolesMock.mockReset()
    createRoleMock.mockReset()
    patchRoleMock.mockReset()
    deleteRoleMock.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()

    listRolesMock.mockResolvedValue([ADMIN_ROLE])
    listPermissionsMock.mockResolvedValue([])
    listTenantMembersMock.mockResolvedValue(memberPage([]))
    listTenantCustomersMock.mockResolvedValue(customerPage([]))
    inviteTenantMemberMock.mockResolvedValue(INVITE_RESPONSE)
    assignUserRolesMock.mockResolvedValue(undefined)
    createRoleMock.mockResolvedValue(CREATED_ROLE)
    patchRoleMock.mockResolvedValue(CUSTOM_ROLE)
    deleteRoleMock.mockResolvedValue(undefined)
  })

  it("renders the page title and description", async () => {
    renderPage(READ_USERS)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: i18n.t("peopleAccess.title"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("peopleAccess.description")),
    ).toBeInTheDocument()
  })

  it("defaults to the users tab and can switch to roles when core.roles.read is present", async () => {
    const user = userEvent.setup()
    renderPage(READ_ROLES)

    await waitForUsersLoaded()

    expect(
      screen.getByRole("button", { name: i18n.t("peopleAccess.tabs.users") }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("peopleAccess.tabs.roles") }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("peopleAccess.users.description")),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.tabs.roles") }),
    )

    expect(
      await screen.findByText(i18n.t("peopleAccess.roles.description")),
    ).toBeInTheDocument()
  })

  it("hides the roles tab without core.roles.read", async () => {
    renderPage(READ_USERS)

    await waitForUsersLoaded()

    expect(
      screen.getByRole("button", { name: i18n.t("peopleAccess.tabs.users") }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("peopleAccess.tabs.roles") }),
    ).not.toBeInTheDocument()
    expect(listRolesMock).not.toHaveBeenCalled()
    expect(listPermissionsMock).not.toHaveBeenCalled()
  })

  it("shows the empty users copy when there are no members", async () => {
    renderPage(READ_USERS)

    expect(
      await screen.findByText(i18n.t("peopleAccess.users.empty")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("peopleAccess.users.emptyDescription")),
    ).toBeInTheDocument()
  })

  it("renders member name, email, role, status, and assign when permitted", async () => {
    listTenantMembersMock.mockResolvedValue(memberPage([MEMBER]))
    renderPage(ASSIGN_PERMS)

    expect(await screen.findByText(MEMBER.fullName)).toBeInTheDocument()
    expect(screen.getByText(MEMBER.email)).toBeInTheDocument()
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("peopleAccess.status.active")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("peopleAccess.users.assign") }),
    ).toBeInTheDocument()
  })

  it("opens the existing invite dialog from the invite button", async () => {
    const user = userEvent.setup()
    renderPage(INVITE_PERMS)

    await waitForUsersLoaded()

    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.users.invite") }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByText(i18n.t("peopleAccess.users.inviteTitle")),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(i18n.t("peopleAccess.users.inviteDescription")),
    ).toBeInTheDocument()
  })

  it("submits inviteTenantMember with form values and blocks invalid email client-side", async () => {
    const user = userEvent.setup()
    renderPage(INVITE_PERMS)

    await waitForUsersLoaded()

    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.users.invite") }),
    )

    const dialog = await screen.findByRole("dialog")

    await user.type(
      within(dialog).getByLabelText(i18n.t("peopleAccess.users.fullName")),
      "Bruno Lima",
    )
    await user.type(
      within(dialog).getByLabelText(i18n.t("peopleAccess.users.email")),
      "not-an-email",
    )
    await user.click(within(dialog).getByRole("checkbox", { name: "Admin" }))
    expect(within(dialog).getByRole("checkbox", { name: "Admin" })).toBeChecked()

    const inviteForm = dialog.querySelector("form")
    if (!(inviteForm instanceof HTMLFormElement)) {
      throw new Error("Invite form was not rendered.")
    }

    fireEvent.submit(inviteForm)

    expect(
      await within(dialog).findByText(
        i18n.t("peopleAccess.validation.emailInvalid"),
      ),
    ).toBeInTheDocument()
    expect(inviteTenantMemberMock).not.toHaveBeenCalled()

    await user.clear(
      within(dialog).getByLabelText(i18n.t("peopleAccess.users.email")),
    )
    await user.type(
      within(dialog).getByLabelText(i18n.t("peopleAccess.users.email")),
      "bruno@example.com",
    )
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("peopleAccess.users.sendInvite"),
      }),
    )

    await waitFor(() => {
      expect(inviteTenantMemberMock).toHaveBeenCalledWith({
        fullName: "Bruno Lima",
        email: "bruno@example.com",
        roleIds: [ROLE_ID],
      })
    })
  })

  it("hides the portal customers tab without core.customers.read", async () => {
    renderPage(READ_USERS)

    await waitForUsersLoaded()

    expect(
      screen.queryByRole("button", {
        name: i18n.t("peopleAccess.tabs.customers"),
      }),
    ).not.toBeInTheDocument()
    expect(listTenantCustomersMock).not.toHaveBeenCalled()
  })

  it("shows portal customers on their tab and keeps the team empty copy separate", async () => {
    const user = userEvent.setup()
    listTenantCustomersMock.mockResolvedValue(customerPage([CUSTOMER]))
    renderPage(CUSTOMER_PERMS)

    expect(
      await screen.findByText(i18n.t("peopleAccess.users.empty")),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.tabs.customers"),
      }),
    )

    expect(await screen.findByText(CUSTOMER.name)).toBeInTheDocument()
    expect(screen.getByText(CUSTOMER.email ?? "")).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("peopleAccess.customers.verified")),
    ).toBeInTheDocument()
    expect(screen.getByText(/13\/10\/2026/)).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("peopleAccess.users.empty")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("peopleAccess.customers.empty")),
    ).not.toBeInTheDocument()
  })

  it("searches the team with at least two characters", async () => {
    const user = userEvent.setup()
    renderPage(READ_USERS)
    await waitForUsersLoaded()

    await user.type(
      screen.getByLabelText(i18n.t("peopleAccess.users.searchLabel")),
      "a",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.users.searchAction"),
      }),
    )

    expect(
      screen.getByText(i18n.t("peopleAccess.users.searchTooShort")),
    ).toBeInTheDocument()
    expect(listTenantMembersMock).toHaveBeenCalledTimes(1)

    await user.type(
      screen.getByLabelText(i18n.t("peopleAccess.users.searchLabel")),
      "n",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("peopleAccess.users.searchAction"),
      }),
    )

    await waitFor(() => {
      expect(listTenantMembersMock).toHaveBeenCalledWith({
        q: "an",
        page: 1,
        pageSize: 20,
      })
    })
  })

  it("does not render the support-mode banner on this page", async () => {
    renderPage(READ_USERS)

    await waitForUsersLoaded()

    expect(
      screen.queryByText(
        i18n.t("admin.support.banner", {
          tenant: i18n.t("admin.support.tenantFallback"),
        }),
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("admin.support.exit")),
    ).not.toBeInTheDocument()
  })
})

describe("People users and roles validity gate", () => {
  beforeEach(() => {
    listRolesMock.mockReset()
    listPermissionsMock.mockReset()
    listTenantMembersMock.mockReset()
    listTenantCustomersMock.mockReset()
    inviteTenantMemberMock.mockReset()
    assignUserRolesMock.mockReset()
    createRoleMock.mockReset()
    patchRoleMock.mockReset()
    deleteRoleMock.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()

    listRolesMock.mockResolvedValue([ADMIN_ROLE])
    listPermissionsMock.mockResolvedValue([USERS_READ_PERMISSION])
    listTenantMembersMock.mockResolvedValue(memberPage([]))
    listTenantCustomersMock.mockResolvedValue(customerPage([]))
    inviteTenantMemberMock.mockResolvedValue(INVITE_RESPONSE)
    assignUserRolesMock.mockResolvedValue(undefined)
    createRoleMock.mockResolvedValue(CREATED_ROLE)
    patchRoleMock.mockResolvedValue(CUSTOM_ROLE)
    deleteRoleMock.mockResolvedValue(undefined)
  })

  function permissionLabel() {
    return i18n.t(`peopleAccess.catalog.${USERS_READ_PERMISSION.key}`, {
      defaultValue: USERS_READ_PERMISSION.name,
    })
  }

  async function openInviteDialog(user: ReturnType<typeof userEvent.setup>) {
    await waitForUsersLoaded()
    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.users.invite") }),
    )
    return screen.findByRole("dialog")
  }

  it("keeps Enviar convite disabled until name, e-mail and a role pass the schema", async () => {
    const user = userEvent.setup()
    renderPage(INVITE_PERMS)
    const dialog = await openInviteDialog(user)

    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.users.sendInvite"),
    })
    const close = within(dialog).getByRole("button", {
      name: i18n.t("common.close"),
    })
    expect(submit).toBeDisabled()
    expect(close).toBeEnabled()

    const name = within(dialog).getByLabelText(i18n.t("peopleAccess.users.fullName"))
    const email = within(dialog).getByLabelText(i18n.t("peopleAccess.users.email"))
    await user.type(name, "A")
    expect(submit).toBeDisabled()

    await user.clear(name)
    await user.type(name, "Ana Souza")
    await user.type(email, "not-an-email")
    await user.click(within(dialog).getByRole("checkbox", { name: "Admin" }))
    expect(submit).toBeDisabled()
    expect(inviteTenantMemberMock).not.toHaveBeenCalled()

    await user.clear(email)
    await user.type(email, "ana@example.com")
    expect(submit).toBeEnabled()
    expect(close).toBeEnabled()

    await user.click(within(dialog).getByRole("checkbox", { name: "Admin" }))
    expect(submit).toBeDisabled()
    expect(close).toBeEnabled()

    await user.click(within(dialog).getByRole("checkbox", { name: "Admin" }))
    expect(submit).toBeEnabled()

    await user.clear(name)
    await user.type(name, "  A")
    expect(submit).toBeDisabled()
    expect(close).toBeEnabled()
    expect(inviteTenantMemberMock).not.toHaveBeenCalled()
  })

  it("re-enables Enviar convite after a duplicate e-mail error and keeps the entered values", async () => {
    const user = userEvent.setup()
    let rejectInvite: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    inviteTenantMemberMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectInvite = reject
        }),
    )
    renderPage(INVITE_PERMS)
    const dialog = await openInviteDialog(user)

    const name = within(dialog).getByLabelText(i18n.t("peopleAccess.users.fullName"))
    const email = within(dialog).getByLabelText(i18n.t("peopleAccess.users.email"))
    await user.type(name, "Ana Souza")
    await user.type(email, "ana@example.com")
    await user.click(within(dialog).getByRole("checkbox", { name: "Admin" }))

    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.users.sendInvite"),
    })
    expect(submit).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.close") }),
    ).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(submit).toBeDisabled()
    })

    rejectInvite(new Error("E-mail já cadastrado."))

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("peopleAccess.users.sendInvite"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("E-mail já cadastrado.")
    expect(name).toHaveValue("Ana Souza")
    expect(email).toHaveValue("ana@example.com")
    expect(within(dialog).getByRole("checkbox", { name: "Admin" })).toBeChecked()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.close") }),
    ).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(inviteTenantMemberMock).toHaveBeenCalledTimes(1)

    inviteTenantMemberMock.mockResolvedValueOnce(INVITE_RESPONSE)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("peopleAccess.users.sendInvite"),
      }),
    )
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("peopleAccess.toasts.inviteSuccess"),
      )
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(inviteTenantMemberMock).toHaveBeenCalledTimes(2)
    expect(inviteTenantMemberMock).toHaveBeenLastCalledWith({
      fullName: "Ana Souza",
      email: "ana@example.com",
      roleIds: [ROLE_ID],
    })
  })

  it("keeps Salvar funções disabled until at least one role stays selected", async () => {
    listTenantMembersMock.mockResolvedValue(memberPage([MEMBER]))
    const user = userEvent.setup()
    renderPage(ASSIGN_PERMS)
    await waitForUsersLoaded()

    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.users.assign") }),
    )
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.users.saveRoles"),
    })
    const close = within(dialog).getByRole("button", {
      name: i18n.t("common.close"),
    })
    const role = within(dialog).getByRole("checkbox", { name: "Admin" })

    expect(role).toBeChecked()
    expect(submit).toBeEnabled()
    expect(close).toBeEnabled()

    await user.click(role)
    expect(role).not.toBeChecked()
    expect(submit).toBeDisabled()
    expect(close).toBeEnabled()
    expect(assignUserRolesMock).not.toHaveBeenCalled()

    await user.click(role)
    expect(submit).toBeEnabled()
    expect(close).toBeEnabled()
  })

  it("re-enables Salvar funções after a server error and keeps the selected roles", async () => {
    listTenantMembersMock.mockResolvedValue(memberPage([MEMBER]))
    const user = userEvent.setup()
    let rejectAssign: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    assignUserRolesMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectAssign = reject
        }),
    )
    renderPage(ASSIGN_PERMS)
    await waitForUsersLoaded()
    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.users.assign") }),
    )
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.users.saveRoles"),
    })
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(submit).toBeDisabled()
    })

    rejectAssign(new Error("Não foi possível atribuir as funções."))

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("peopleAccess.users.saveRoles"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Não foi possível atribuir as funções.")
    expect(within(dialog).getByRole("checkbox", { name: "Admin" })).toBeChecked()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.close") }),
    ).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.getByText(MEMBER.fullName)).toBeInTheDocument()
    expect(assignUserRolesMock).toHaveBeenCalledTimes(1)

    assignUserRolesMock.mockResolvedValueOnce(undefined)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("peopleAccess.users.saveRoles"),
      }),
    )
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("peopleAccess.toasts.assignSuccess"),
      )
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(assignUserRolesMock).toHaveBeenLastCalledWith(MEMBER_ID, {
      roleIds: [ROLE_ID],
    })
  })

  async function openRolesTab(user: ReturnType<typeof userEvent.setup>) {
    await waitForUsersLoaded()
    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.tabs.roles") }),
    )
    expect(
      await screen.findByText(i18n.t("peopleAccess.roles.description")),
    ).toBeInTheDocument()
  }

  it("keeps Salvar disabled until the role name passes the schema, with permissions optional", async () => {
    const user = userEvent.setup()
    renderPage(MANAGE_ROLES)
    await openRolesTab(user)

    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.roles.create") }),
    )
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.roles.save"),
    })
    const close = within(dialog).getByRole("button", { name: "Close" })
    expect(submit).toBeDisabled()
    expect(close).toBeEnabled()

    const name = within(dialog).getByLabelText(i18n.t("peopleAccess.role"))
    await user.type(name, "A")
    expect(submit).toBeDisabled()
    expect(createRoleMock).not.toHaveBeenCalled()

    await user.type(name, "b")
    expect(name).toHaveValue("Ab")
    expect(submit).toBeEnabled()

    const permission = within(dialog).getByRole("checkbox", {
      name: permissionLabel(),
    })
    await user.click(permission)
    expect(permission).toBeChecked()
    expect(submit).toBeEnabled()
    expect(close).toBeEnabled()

    await user.clear(name)
    expect(submit).toBeDisabled()
    expect(close).toBeEnabled()
    expect(createRoleMock).not.toHaveBeenCalled()
  })

  it("keeps Salvar disabled when editing a role until the name is valid again", async () => {
    listRolesMock.mockResolvedValue([CUSTOM_ROLE])
    const user = userEvent.setup()
    renderPage(MANAGE_ROLES)
    await openRolesTab(user)

    await user.click(screen.getByRole("button", { name: i18n.t("common.edit") }))
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.roles.save"),
    })
    const name = within(dialog).getByLabelText(i18n.t("peopleAccess.role"))
    const permission = within(dialog).getByRole("checkbox", {
      name: permissionLabel(),
    })

    expect(name).toHaveValue("Recepção")
    expect(permission).toBeChecked()
    expect(submit).toBeEnabled()
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled()

    await user.clear(name)
    await user.type(name, "A")
    expect(submit).toBeDisabled()
    expect(patchRoleMock).not.toHaveBeenCalled()

    await user.clear(name)
    await user.type(name, "Recepção")
    await user.click(permission)
    expect(permission).not.toBeChecked()
    expect(submit).toBeEnabled()
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled()
  })

  it("re-enables Salvar after a role create server error and keeps name and permissions", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createRoleMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectCreate = reject
        }),
    )
    renderPage(MANAGE_ROLES)
    await openRolesTab(user)
    await user.click(
      screen.getByRole("button", { name: i18n.t("peopleAccess.roles.create") }),
    )
    const dialog = await screen.findByRole("dialog")
    const name = within(dialog).getByLabelText(i18n.t("peopleAccess.role"))
    const description = within(dialog).getByLabelText(
      i18n.t("peopleAccess.roles.descriptionLabel"),
    )
    await user.type(name, "Portaria")
    await user.type(description, "Entrada")
    await user.click(
      within(dialog).getByRole("checkbox", { name: permissionLabel() }),
    )

    const submit = within(dialog).getByRole("button", {
      name: i18n.t("peopleAccess.roles.save"),
    })
    expect(submit).toBeEnabled()
    await user.click(submit)

    await waitFor(() => {
      expect(submit).toBeDisabled()
    })

    rejectCreate(new Error("Nome já cadastrado."))

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", {
          name: i18n.t("peopleAccess.roles.save"),
        }),
      ).toBeEnabled()
    })
    expect(toastError).toHaveBeenCalledWith("Nome já cadastrado.")
    expect(name).toHaveValue("Portaria")
    expect(description).toHaveValue("Entrada")
    expect(
      within(dialog).getByRole("checkbox", { name: permissionLabel() }),
    ).toBeChecked()
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled()
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(createRoleMock).toHaveBeenCalledTimes(1)

    createRoleMock.mockResolvedValueOnce(CREATED_ROLE)
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("peopleAccess.roles.save"),
      }),
    )
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(
        i18n.t("peopleAccess.toasts.roleCreated"),
      )
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(createRoleMock).toHaveBeenLastCalledWith({
      name: "Portaria",
      description: "Entrada",
      permissionKeys: [USERS_READ_PERMISSION.key],
    })
  })

  it("leaves role deletion ungated", async () => {
    listRolesMock.mockResolvedValue([CUSTOM_ROLE])
    const user = userEvent.setup()
    renderPage(MANAGE_ROLES)
    await openRolesTab(user)

    await user.click(screen.getByRole("button", { name: i18n.t("common.delete") }))
    const dialog = await screen.findByRole("alertdialog")
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.delete") }),
    ).toBeEnabled()
    expect(
      within(dialog).getByRole("button", { name: i18n.t("common.cancel") }),
    ).toBeEnabled()
    expect(deleteRoleMock).not.toHaveBeenCalled()
  })
})
