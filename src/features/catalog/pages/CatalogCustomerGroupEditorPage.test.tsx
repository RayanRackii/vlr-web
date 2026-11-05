import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CatalogCustomerGroupEditorPage } from "@/features/catalog/pages/CatalogCustomerGroupEditorPage"
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
  createCustomerGroup,
  updateCustomerGroup,
  getCustomerGroupHistory,
  removeCustomerGroupMember,
  deleteCustomerGroup,
  addCustomerGroupMembers,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import { listTenantCustomers } from "@/features/users/services/usersService"

const GROUP = {
  id: "g1", name: "Revenda", description: "Parceiros", memberCustomerIds: ["c1", "c2"],
  createdAt: "2026-11-03T10:00:00Z", updatedAt: null,
}

function renderEditor(path = "/catalogo/grupos/g1", permissions = ["catalog.products.read", "catalog.products.manage", "core.customers.read"]) {
  const router = createMemoryRouter([
    { path: "/catalogo/grupos", element: <p>Group list destination</p> },
    { path: "/catalogo/grupos/novo", element: <CatalogCustomerGroupEditorPage /> },
    { path: "/catalogo/grupos/:id", element: <CatalogCustomerGroupEditorPage /> },
  ], { initialEntries: [path] })
  render(<TestPermissionProvider permissions={permissions}><RouterProvider router={router} /></TestPermissionProvider>)
  return router
}
const tr = (key: string) => i18n.t(`catalog.customerGroups.${key}`)
const nameInput = () => screen.getByLabelText(tr("form.name"))
const saveButton = () => screen.getAllByRole("button", { name: tr("save") })[0]!

describe("CatalogCustomerGroupEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listCustomerGroups).mockResolvedValue([GROUP])
    vi.mocked(listCatalogProducts).mockResolvedValue([])
    vi.mocked(getCustomerGroupHistory).mockResolvedValue([])
    vi.mocked(listTenantCustomers).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 } as never)
    vi.mocked(updateCustomerGroup).mockResolvedValue({ ...GROUP, name: "Updated" })
    vi.mocked(createCustomerGroup).mockResolvedValue({ ...GROUP, id: "g2", name: "New group", memberCustomerIds: [] })
  })

  it("opens all three sections directly without an editor dialog", async () => {
    renderEditor()
    expect(await screen.findByDisplayValue("Revenda")).toBeInTheDocument()
    for (const section of ["details", "members", "history"]) {
      expect(screen.getByRole("heading", { name: new RegExp(tr(`tabs.${section}`)) })).toBeVisible()
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await userEvent.click(screen.getByText(tr("page.whereUsed")))
    expect(screen.getByText(tr("page.deleteNoAffected"))).toBeVisible()
  })

  it("keeps member removal and group deletion in confirmation dialogs", async () => {
    renderEditor()
    await screen.findByDisplayValue("Revenda")
    await userEvent.click(screen.getAllByRole("button", { name: tr("members.remove") })[0]!)
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(removeCustomerGroupMember).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    await userEvent.click(screen.getByRole("button", { name: tr("delete") }))
    expect(screen.getByRole("dialog")).toBeVisible()
    expect(deleteCustomerGroup).not.toHaveBeenCalled()
  })

  it("guards dirty navigation and unload, and lets the user stay or discard", async () => {
    const router = renderEditor()
    await screen.findByDisplayValue("Revenda")
    await userEvent.type(nameInput(), " changed")
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await userEvent.click(screen.getAllByRole("button", { name: i18n.t("common.cancel") })[0]!)
    expect(await screen.findByText(tr("page.leaveTitle"))).toBeVisible()
    await userEvent.click(screen.getAllByRole("button", { name: i18n.t("common.cancel") }).at(-1)!)
    expect(router.state.location.pathname).toBe("/catalogo/grupos/g1")
    expect(nameInput()).toHaveValue("Revenda changed")
    await userEvent.click(screen.getAllByRole("button", { name: i18n.t("common.cancel") })[0]!)
    await userEvent.click(screen.getByRole("button", { name: tr("page.leave") }))
    expect(await screen.findByText("Group list destination")).toBeVisible()
  })

  it("saves edited fields and clears the dirty guard", async () => {
    renderEditor()
    await screen.findByDisplayValue("Revenda")
    await userEvent.clear(nameInput())
    await userEvent.type(nameInput(), "Updated")
    await userEvent.click(saveButton())
    await waitFor(() => expect(updateCustomerGroup).toHaveBeenCalledWith("g1", { name: "Updated", description: "Parceiros" }))
    await userEvent.click(screen.getAllByRole("button", { name: i18n.t("common.cancel") })[0]!)
    expect(await screen.findByText("Group list destination")).toBeVisible()
  })

  it("retains unsaved values after a save failure", async () => {
    vi.mocked(updateCustomerGroup).mockRejectedValue(new Error("offline"))
    renderEditor()
    await screen.findByDisplayValue("Revenda")
    await userEvent.type(nameInput(), " changed")
    await userEvent.click(saveButton())
    await waitFor(() => expect(updateCustomerGroup).toHaveBeenCalled())
    expect(nameInput()).toHaveValue("Revenda changed")
    expect(saveButton()).toBeEnabled()
  })

  it("blocks cancel, router departure and unload while saving", async () => {
    let finish!: (value: typeof GROUP) => void
    vi.mocked(updateCustomerGroup).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const router = renderEditor()
    await screen.findByDisplayValue("Revenda")
    await userEvent.click(saveButton())
    await waitFor(() => expect(updateCustomerGroup).toHaveBeenCalled())
    expect(screen.getAllByRole("button", { name: i18n.t("common.cancel") })[0]).toBeDisabled()
    await router.navigate("/catalogo/grupos")
    expect(router.state.location.pathname).toBe("/catalogo/grupos/g1")
    const event = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    finish(GROUP)
    await waitFor(() => expect(saveButton()).toBeEnabled())
  })

  it("creates a group then opens its member editor without a dirty prompt", async () => {
    const router = renderEditor("/catalogo/grupos/novo")
    expect(screen.getByText(tr("page.saveFirst"))).toBeVisible()
    await userEvent.type(nameInput(), "New group")
    await userEvent.click(saveButton())
    await waitFor(() => expect(router.state.location.pathname).toBe("/catalogo/grupos/g2"), { timeout: 4500 })
    expect(screen.queryByText(tr("page.leaveTitle"))).not.toBeInTheDocument()
  })

  it("preserves the customer-directory permission hint", async () => {
    renderEditor(undefined, ["catalog.products.read", "catalog.products.manage"])
    await screen.findByDisplayValue("Revenda")
    expect(screen.getByText(i18n.t("catalog.products.access.needCustomersPermission"))).toBeVisible()
    expect(listTenantCustomers).not.toHaveBeenCalled()
  })

  it("shows history failures without hiding the form", async () => {
    vi.mocked(getCustomerGroupHistory).mockRejectedValue(new Error("offline"))
    renderEditor()
    await screen.findByDisplayValue("Revenda")
    expect(await screen.findByText(i18n.t("catalog.products.access.history.loadError"))).toBeVisible()
  })

  it("searches and adds members through the existing service", async () => {
    const customer = { id: "c3", name: "Maria", email: "maria@example.test" }
    vi.mocked(listTenantCustomers).mockResolvedValue({ items: [customer], totalCount: 1, page: 1, pageSize: 20 } as never)
    vi.mocked(addCustomerGroupMembers).mockResolvedValue({ ...GROUP, memberCustomerIds: ["c1", "c2", "c3"] })
    renderEditor()
    await screen.findByDisplayValue("Revenda")
    await userEvent.type(screen.getByLabelText(tr("members.searchLabel")), "Maria")
    await userEvent.click(await screen.findByRole("button", { name: /Maria/ }))
    await userEvent.click(screen.getByRole("button", { name: tr("members.addSelected") }))
    await waitFor(() => expect(addCustomerGroupMembers).toHaveBeenCalledWith("g1", ["c3"]))
  })
})
