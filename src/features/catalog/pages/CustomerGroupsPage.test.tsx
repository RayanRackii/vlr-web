import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from "react-router-dom"

import { CustomerGroupFormPage } from "@/features/catalog/pages/CustomerGroupFormPage"
import { CustomerGroupsPage } from "@/features/catalog/pages/CustomerGroupsPage"
import { catalogManifest } from "@/features/catalog/manifest"
import {
  CatalogDuplicateGroupNameError,
  addCustomerGroupMembers,
  createCustomerGroup,
  deleteCustomerGroup,
  getCatalogProductAccess,
  getCustomerGroup,
  removeCustomerGroupMember,
  listCatalogProducts,
  listCustomerGroups,
  updateCustomerGroup,
} from "@/features/catalog/services/catalogService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { listTenantCustomers } from "@/features/users/services/usersService"
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
    getCustomerGroup: vi.fn(),
    getCatalogProductAccess: vi.fn(),
    listCatalogProducts: vi.fn(),
  }
})
vi.mock("@/features/users/services/usersService", () => ({ listTenantCustomers: vi.fn() }))

const GROUP = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Clientes frequentes",
  description: "Recebem horários antecipados",
  memberCustomerIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  createdAt: "2026-11-03T10:00:00Z",
  updatedAt: null,
}
const CUSTOMER = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Ana Lima",
  email: "ana.lima@exemplo.com",
  emailVerified: true,
  createdAt: "2026-11-01T00:00:00Z",
}
const MANAGE = ["catalog.products.read", "catalog.products.manage"]

function renderAt(path: string, permissions: string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TestPermissionProvider permissions={permissions}>
        <Routes>
          <Route path="/grupos" element={<CustomerGroupsPage />} />
          <Route path="/grupos/novo" element={<CustomerGroupFormPage />} />
          <Route path="/grupos/:id" element={<CustomerGroupFormPage />} />
          <Route path="/catalogo/grupos" element={<p>Old groups</p>} />
        </Routes>
      </TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("CustomerGroupsPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR")
    vi.mocked(listCustomerGroups).mockReset()
    vi.mocked(listCatalogProducts).mockReset()
    vi.mocked(getCatalogProductAccess).mockReset()
    vi.mocked(deleteCustomerGroup).mockReset()
    vi.mocked(createCustomerGroup).mockReset()
    vi.mocked(updateCustomerGroup).mockReset()
    vi.mocked(addCustomerGroupMembers).mockReset()
    vi.mocked(removeCustomerGroupMember).mockReset()
    vi.mocked(getCustomerGroup).mockReset()
    vi.mocked(listTenantCustomers).mockReset()
    vi.mocked(listCustomerGroups).mockResolvedValue([GROUP])
    vi.mocked(listCatalogProducts).mockResolvedValue([])
    vi.mocked(listTenantCustomers).mockResolvedValue({ items: [CUSTOMER], total: 1, page: 1, pageSize: 50 })
  })

  it("keeps the old groups routes and gives the new ones the same permission", () => {
    const paths = ["/catalogo/grupos", "/catalogo/grupos/novo", "/catalogo/grupos/:id", "/grupos", "/grupos/novo", "/grupos/:id"]
    for (const path of paths) {
      expect(catalogManifest.routes.staff.find((route) => route.path === path)?.permission).toBe("catalog.products.read")
    }
  })

  it("renders the list, a member badge, and the new-group link", async () => {
    renderAt("/grupos", MANAGE)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(await screen.findByText(GROUP.name)).toBeInTheDocument()
    const badge = screen.getByText(i18n.t("catalog.customerGroups.memberCount", { count: 2 }))
    expect(badge.className).toContain("grupos-badge")
    expect(badge.className).not.toMatch(/w-full|flex-1/)
    expect(screen.getByText(/Recebem horários antecipados/)).toBeInTheDocument()
    expect(screen.getByText(/Sem uso/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: i18n.t("grupos.create") })).toHaveAttribute("href", "/grupos/novo")
    expect(screen.getByRole("link", { name: i18n.t("grupos.edit") })).toHaveAttribute("href", `/grupos/${GROUP.id}`)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.querySelector("select")).not.toBeInTheDocument()
  })

  it("shows the empty state action and hides writes for a reader", async () => {
    vi.mocked(listCustomerGroups).mockResolvedValue([])
    renderAt("/grupos", ["catalog.products.read"])
    expect(await screen.findByText(i18n.t("grupos.emptyTitle"))).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: i18n.t("grupos.create") })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: i18n.t("grupos.emptyAction") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: i18n.t("grupos.delete") })).not.toBeInTheDocument()
  })

  it("offers the empty-state action to someone who can manage groups", async () => {
    vi.mocked(listCustomerGroups).mockResolvedValue([])
    renderAt("/grupos", MANAGE)
    expect(await screen.findByRole("link", { name: i18n.t("grupos.emptyAction") })).toHaveAttribute("href", "/grupos/novo")
  })

  it("clears a search that matches nothing", async () => {
    const user = userEvent.setup()
    renderAt("/grupos", MANAGE)
    await screen.findByText(GROUP.name)
    await user.type(screen.getByRole("searchbox", { name: i18n.t("grupos.search") }), "zzz")
    expect(screen.getByText(i18n.t("grupos.noResultsTitle"))).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.clear") }))
    expect(screen.getByText(GROUP.name)).toBeInTheDocument()
  })

  it("confirms delete on the row and does not open a dialog", async () => {
    const user = userEvent.setup()
    vi.mocked(deleteCustomerGroup).mockResolvedValue()
    renderAt("/grupos", MANAGE)
    await screen.findByText(GROUP.name)
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.delete") }))
    expect(screen.getByText(i18n.t("grupos.deleteConfirm"))).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.delete") }))
    await waitFor(() => expect(deleteCustomerGroup).toHaveBeenCalledWith(GROUP.id))
    expect(screen.queryByText(GROUP.name)).not.toBeInTheDocument()
  })

  it("creates a group from the full page and can attach the first members", async () => {
    const user = userEvent.setup()
    vi.mocked(createCustomerGroup).mockResolvedValue({ ...GROUP, id: "22222222-2222-4222-8222-222222222222", memberCustomerIds: [] })
    vi.mocked(addCustomerGroupMembers).mockResolvedValue(GROUP)
    renderAt("/grupos/novo", [...MANAGE, "core.customers.read"])
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("grupos.createTitle"))
    expect(screen.getByRole("button", { name: i18n.t("grupos.save") })).toBeDisabled()
    expect(listTenantCustomers).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.members") }))
    await screen.findByRole("checkbox", { name: /Ana Lima/ })
    expect(listTenantCustomers).toHaveBeenCalled()
    await user.click(screen.getByRole("checkbox", { name: /Ana Lima/ }))
    await user.type(screen.getByLabelText(i18n.t("grupos.name")), "Clientes frequentes")
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.save") }))
    await waitFor(() => expect(createCustomerGroup).toHaveBeenCalledWith({ name: "Clientes frequentes", description: null }))
    expect(addCustomerGroupMembers).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", [CUSTOMER.id])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not load the customer directory without permission and shows a duplicate name on the field", async () => {
    const user = userEvent.setup()
    vi.mocked(createCustomerGroup).mockRejectedValue(new CatalogDuplicateGroupNameError(i18n.t("catalog.customerGroups.errors.duplicateName")))
    renderAt("/grupos/novo", MANAGE)
    expect(screen.queryByRole("button", { name: i18n.t("grupos.members") })).not.toBeInTheDocument()
    expect(listTenantCustomers).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(i18n.t("grupos.name")), "Clientes frequentes")
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.save") }))
    expect(await screen.findByText(i18n.t("catalog.customerGroups.errors.duplicateName"))).toBeInTheDocument()
    expect(createCustomerGroup).toHaveBeenCalledTimes(1)
  })

  it("edits an existing group on its own page", async () => {
    const user = userEvent.setup()
    vi.mocked(getCustomerGroup).mockResolvedValue(GROUP)
    vi.mocked(updateCustomerGroup).mockResolvedValue(GROUP)
    renderAt(`/grupos/${GROUP.id}`, MANAGE)
    expect(await screen.findByDisplayValue(GROUP.name)).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(i18n.t("grupos.editTitle"))
    expect(screen.getByRole("button", { name: i18n.t("grupos.save") })).toBeDisabled()
    await user.type(screen.getByLabelText(i18n.t("grupos.name")), " 2")
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.save") }))
    await waitFor(() => expect(updateCustomerGroup).toHaveBeenCalledWith(GROUP.id, { name: `${GROUP.name} 2`, description: GROUP.description }))
  })

  it("adds and removes members on the edit page through the customers query", async () => {
    const user = userEvent.setup()
    vi.mocked(getCustomerGroup).mockResolvedValue({ ...GROUP, memberCustomerIds: [CUSTOMER.id], memberNames: { [CUSTOMER.id]: CUSTOMER.name } })
    vi.mocked(listTenantCustomers).mockResolvedValue({ items: [{ ...CUSTOMER, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Bruno Tavares" }], total: 1, page: 1, pageSize: 20 })
    vi.mocked(addCustomerGroupMembers).mockResolvedValue({ ...GROUP, memberCustomerIds: [CUSTOMER.id, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"], memberNames: { [CUSTOMER.id]: CUSTOMER.name, "cccccccc-cccc-4ccc-8ccc-cccccccccccc": "Bruno Tavares" } })
    vi.mocked(removeCustomerGroupMember).mockResolvedValue({ ...GROUP, memberCustomerIds: [], memberNames: {} })
    renderAt(`/grupos/${GROUP.id}`, [...MANAGE, "core.customers.read"])
    await screen.findByDisplayValue(GROUP.name)
    await user.click(screen.getByRole("button", { name: i18n.t("grupos.membersEdit") }))
    expect(screen.getByText(CUSTOMER.name)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.customerGroups.members.remove") }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("catalog.customerGroups.members.remove") }))
    await waitFor(() => expect(removeCustomerGroupMember).toHaveBeenCalledWith(GROUP.id, CUSTOMER.id))
    await user.type(screen.getByRole("searchbox", { name: i18n.t("catalog.customerGroups.members.searchLabel") }), "Bruno")
    await waitFor(() => expect(listTenantCustomers).toHaveBeenCalledWith({ q: "Bruno", pageSize: 20 }))
    await user.click(await screen.findByRole("button", { name: i18n.t("grupos.addMember") }))
    await waitFor(() => expect(addCustomerGroupMembers).toHaveBeenCalledWith(GROUP.id, ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]))
  })

  it("asks before leaving the form with unsaved changes", async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(
      [
        { path: "/grupos/novo", element: <CustomerGroupFormPage /> },
        { path: "/grupos", element: <p>groups list</p> },
      ],
      { initialEntries: ["/grupos/novo"] },
    )
    render(
      <TestPermissionProvider permissions={MANAGE}>
        <RouterProvider router={router} />
      </TestPermissionProvider>,
    )
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await user.type(screen.getByLabelText(i18n.t("grupos.name")), "Clientes")
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(screen.queryByText("groups list")).not.toBeInTheDocument()
  })
})
