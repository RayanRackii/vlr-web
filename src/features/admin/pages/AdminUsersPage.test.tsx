import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminUsersPage } from "@/features/admin/pages/AdminUsersPage"
import { listAdminTenants } from "@/features/admin/services/adminTenantsService"
import {
  listPlatformUsers,
  type PlatformUser,
} from "@/features/admin/services/platformUsersService"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/services/adminTenantsService", () => ({
  listAdminTenants: vi.fn(),
}))
vi.mock("@/features/admin/services/platformUsersService", () => ({
  listPlatformUsers: vi.fn(),
  deletePlatformUser: vi.fn(),
}))

const account: PlatformUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Alex Silva",
  email: "alex.silva@empresa.example",
  tenantId: "22222222-2222-4222-8222-222222222222",
  tenantLegalName: "Empresa Exemplo",
  tenantSubdomain: "empresa",
  roles: ["Admin"],
  isActive: true,
  createdAt: "2026-10-28T12:00:00Z",
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.mocked(listAdminTenants).mockReset().mockResolvedValue([])
    vi.mocked(listPlatformUsers).mockReset().mockResolvedValue([account])
  })

  it("offers retry after a network failure and replaces the error with users", async () => {
    vi.mocked(listPlatformUsers).mockRejectedValueOnce(new Error("Network Error"))
    const user = userEvent.setup()
    render(<AdminUsersPage />)

    const error = await screen.findByRole("alert")
    await user.click(within(error).getByRole("button", { name: i18n.t("common.retry") }))

    expect((await screen.findAllByText(account.email)).length).toBeGreaterThan(0)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("distinguishes duplicate names by email in cards and opens the selected account's confirmation", async () => {
    const duplicate = {
      ...account,
      id: "33333333-3333-4333-8333-333333333333",
      email: `${"a".repeat(90)}@outra-empresa.example`,
    }
    vi.mocked(listPlatformUsers).mockResolvedValue([account, duplicate])
    const user = userEvent.setup()
    render(<AdminUsersPage />)

    // jsdom does not apply responsive CSS: scope assertions to the mobile list.
    const cards = within(screen.getByRole("list", { name: i18n.t("admin.platformUsers.title") }))
    await cards.findByText(duplicate.email)
    const items = cards.getAllByRole("listitem")
    for (const [index, record] of [account, duplicate].entries()) {
      const card = within(items[index])
      expect(card.getByText(record.fullName)).toBeInTheDocument()
      expect(card.getByText(record.email)).toBeInTheDocument()
      expect(card.getByText(record.tenantLegalName)).toBeInTheDocument()
      expect(card.getByText("Admin")).toBeInTheDocument()
      expect(card.getByRole("button", { name: i18n.t("admin.platformUsers.actions.deleteNamed", { email: record.email }) })).toBeEnabled()
    }

    await user.click(within(items[1]).getByRole("button"))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(duplicate.email)).toBeInTheDocument()
    expect(within(dialog).queryByText(account.email)).not.toBeInTheDocument()
  })
})
