import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { PeopleAccessPage } from "@/features/users/pages/PeopleAccessPage"
import type { RoleResponse } from "@/features/users/schemas/roleSchemas"
import type {
  InviteTenantMemberResponse,
  TenantMember,
} from "@/features/users/schemas/userSchemas"
import {
  listPermissions,
  listRoles,
} from "@/features/users/services/rolesService"
import {
  assignUserRoles,
  inviteTenantMember,
  listTenantMembers,
} from "@/features/users/services/usersService"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/services/rolesService", () => ({
  listRoles: vi.fn(),
  listPermissions: vi.fn(),
}))

vi.mock("@/features/users/services/usersService", () => ({
  listTenantMembers: vi.fn(),
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

const listRolesMock = vi.mocked(listRoles)
const listPermissionsMock = vi.mocked(listPermissions)
const listTenantMembersMock = vi.mocked(listTenantMembers)
const inviteTenantMemberMock = vi.mocked(inviteTenantMember)
const assignUserRolesMock = vi.mocked(assignUserRoles)

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
    inviteTenantMemberMock.mockReset()
    assignUserRolesMock.mockReset()

    listRolesMock.mockResolvedValue([ADMIN_ROLE])
    listPermissionsMock.mockResolvedValue([])
    listTenantMembersMock.mockResolvedValue([])
    inviteTenantMemberMock.mockResolvedValue(INVITE_RESPONSE)
    assignUserRolesMock.mockResolvedValue(undefined)
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
    listTenantMembersMock.mockResolvedValue([MEMBER])
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
