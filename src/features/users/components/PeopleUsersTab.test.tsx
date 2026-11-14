import type { ReactNode } from "react"
import { ModuleIntroLinksProvider } from "@/components/layout/ModuleIntroLinksContext"
import { MemoryRouter } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { render as testingRender, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PeopleUsersTab } from "@/features/users/components/PeopleUsersTab"
import type { TenantMember } from "@/features/users/schemas/userSchemas"
import { listTenantMembers } from "@/features/users/services/usersService"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/services/usersService", () => ({
  listTenantMembers: vi.fn(),
  inviteTenantMember: vi.fn(),
  assignUserRoles: vi.fn(),
}))

const PERMISSIONS = ["core.users.read", "core.users.invite", "core.users.assign_roles"]

function render(ui: ReactNode) {
  return testingRender(
    <AuthProvider>
      <MemoryRouter>
        <TestPermissionProvider permissions={PERMISSIONS}>
          <ModuleIntroLinksProvider keys={["peoplePortal"]}>{ui}</ModuleIntroLinksProvider>
        </TestPermissionProvider>
      </MemoryRouter>
    </AuthProvider>,
  )
}

const listTenantMembersMock = vi.mocked(listTenantMembers)

const MEMBER: TenantMember = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  fullName: "Ana Souza",
  email: "ana@example.com",
  isActive: true,
  roles: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Admin", isSystemRole: true }],
}

function memberPage(items: TenantMember[]) {
  return { items, page: 1, pageSize: 20, total: items.length }
}

const usersLabel = i18n.t("peopleAccess.tabs.users")

describe("PeopleUsersTab", () => {
  beforeEach(() => {
    listTenantMembersMock.mockReset()
  })

  it("renders members in the table with name, email, role, status and the assign action", async () => {
    listTenantMembersMock.mockResolvedValue(memberPage([MEMBER]))
    render(<PeopleUsersTab roles={[]} />)

    const table = await screen.findByRole("table", { name: usersLabel })
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4)
    expect(within(table).getByText(MEMBER.fullName)).toBeInTheDocument()
    expect(within(table).getByText(MEMBER.email)).toBeInTheDocument()
    expect(within(table).getByText("Admin")).toBeInTheDocument()
    expect(within(table).getByText(i18n.t("peopleAccess.status.active"))).toBeInTheDocument()
    expect(within(table).getByRole("button", { name: i18n.t("peopleAccess.users.assign") })).toBeInTheDocument()
  })

  it("opens the assign dialog from the card list used below md", async () => {
    const user = userEvent.setup()
    listTenantMembersMock.mockResolvedValue(memberPage([MEMBER]))
    render(<PeopleUsersTab roles={[]} />)

    const list = await screen.findByRole("list", { name: usersLabel })
    expect(within(list).getByText(MEMBER.fullName)).toBeInTheDocument()
    await user.click(within(list).getByRole("button", { name: i18n.t("peopleAccess.users.assign") }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(i18n.t("peopleAccess.users.assignDescription", { name: MEMBER.fullName }))).toBeInTheDocument()
  })

  it("shows a loading status while the list loads", async () => {
    listTenantMembersMock.mockReturnValue(new Promise(() => undefined))
    render(<PeopleUsersTab roles={[]} />)

    expect(screen.getByRole("status", { name: usersLabel })).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows the load error without rows and reloads on Retry", async () => {
    const user = userEvent.setup()
    listTenantMembersMock.mockRejectedValueOnce(new Error("boom"))
    listTenantMembersMock.mockResolvedValueOnce(memberPage([MEMBER]))
    render(<PeopleUsersTab roles={[]} />)

    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText("boom")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()

    await user.click(within(alert).getByRole("button", { name: i18n.t("common.retry") }))

    expect(within(await screen.findByRole("table", { name: usersLabel })).getByText(MEMBER.fullName)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(listTenantMembersMock).toHaveBeenCalledTimes(2)
  })

  it("shows the empty state with the invite action when there are no members", async () => {
    listTenantMembersMock.mockResolvedValue(memberPage([]))
    render(<PeopleUsersTab roles={[]} />)

    expect(await screen.findByText(i18n.t("peopleAccess.users.empty"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("peopleAccess.users.emptyDescription"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("emptyStates.examples.users"))).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: i18n.t("peopleAccess.users.invite") }).length).toBeGreaterThan(0)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
