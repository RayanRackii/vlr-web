import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogCustomerGroupsPage } from "@/features/catalog/pages/CatalogCustomerGroupsPage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/catalog/services/catalogService", async (orig) => {
  const actual = await orig<typeof import("@/features/catalog/services/catalogService")>()
  return {
    CatalogDuplicateGroupNameError: actual.CatalogDuplicateGroupNameError,
    listCustomerGroups: vi.fn(),
    createCustomerGroup: vi.fn(),
    updateCustomerGroup: vi.fn(),
    deleteCustomerGroup: vi.fn(),
    addCustomerGroupMembers: vi.fn(),
    removeCustomerGroupMember: vi.fn(),
    getCustomerGroupHistory: vi.fn(),
    getCatalogProductAccess: vi.fn(),
    listCatalogProducts: vi.fn(),
  }
})
vi.mock("@/features/users/services/usersService", () => ({ listTenantCustomers: vi.fn() }))

import {
  CatalogDuplicateGroupNameError,
  createCustomerGroup,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"

const GROUP = {
  id: "g1", name: "Revenda", description: "Parceiros", memberCustomerIds: ["c1", "c2"],
  createdAt: "2026-11-03T10:00:00Z", updatedAt: null,
}

function renderPage(permissions: string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions}>
        <CatalogCustomerGroupsPage />
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("CatalogCustomerGroupsPage", () => {
  beforeEach(() => {
    vi.mocked(listCustomerGroups).mockResolvedValue([GROUP])
    vi.mocked(listCatalogProducts).mockResolvedValue([])
    vi.mocked(listTenantCustomers).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 } as never)
  })

  it("lists groups with member count", async () => {
    renderPage(["catalog.products.read", "catalog.products.manage"])
    expect((await screen.findAllByText("Revenda")).length).toBeGreaterThan(0)
    expect(screen.getAllByText(i18n.t("catalog.customerGroups.memberCount", { count: 2 })).length).toBeGreaterThan(0)
  })

  it("does not call the customer directory without core.customers.read", async () => {
    vi.mocked(listTenantCustomers).mockClear()
    renderPage(["catalog.products.read", "catalog.products.manage"])
    await screen.findAllByText("Revenda")
    expect(listTenantCustomers).not.toHaveBeenCalled()
  })

  it("preloads customer names when core.customers.read is granted", async () => {
    vi.mocked(listTenantCustomers).mockClear()
    renderPage(["catalog.products.read", "catalog.products.manage", "core.customers.read"])
    await screen.findAllByText("Revenda")
    await waitFor(() => expect(listTenantCustomers).toHaveBeenCalled())
  })

  it("hides the create action for read-only staff", async () => {
    renderPage(["catalog.products.read"])
    await screen.findAllByText("Revenda")
    expect(screen.queryByRole("button", { name: i18n.t("catalog.customerGroups.create") })).not.toBeInTheDocument()
  })

  it("shows a friendly message on duplicate name", async () => {
    vi.mocked(createCustomerGroup).mockRejectedValue(new CatalogDuplicateGroupNameError(i18n.t("catalog.customerGroups.errors.duplicateName")))
    const user = userEvent.setup()
    renderPage(["catalog.products.read", "catalog.products.manage"])
    await screen.findAllByText("Revenda")
    await user.click(screen.getAllByRole("button", { name: i18n.t("catalog.customerGroups.create") })[0]!)
    await user.type(await screen.findByLabelText(i18n.t("catalog.customerGroups.form.name")), "revenda")
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.customerGroups.save") }))
    await waitFor(() => expect(createCustomerGroup).toHaveBeenCalled())
    expect(await screen.findByText(i18n.t("catalog.customerGroups.errors.duplicateName"))).toBeInTheDocument()
    expect(screen.queryByText(/FORBIDDEN|409/)).not.toBeInTheDocument()
  })

  it("does not show the required-name error until the field is touched", async () => {
    const user = userEvent.setup()
    renderPage(["catalog.products.read", "catalog.products.manage"])
    await screen.findAllByText("Revenda")
    await user.click(screen.getAllByRole("button", { name: i18n.t("catalog.customerGroups.create") })[0]!)
    await screen.findByLabelText(i18n.t("catalog.customerGroups.form.name"))
    expect(screen.queryByText(i18n.t("catalog.customerGroups.validation.nameRequired"))).toBeNull()
  })
})
