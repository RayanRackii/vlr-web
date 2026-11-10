import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RoleCreatePage } from "@/features/users/pages/RoleCreatePage"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { createRole } from "@/features/users/services/rolesService"
import i18n from "@/lib/i18n"

vi.mock("@/features/users/services/rolesService", () => ({
  createRole: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const createRoleMock = vi.mocked(createRole)

function renderPage() {
  return render(
    <TestPermissionProvider permissions={["core.roles.manage"]}>
      <MemoryRouter initialEntries={["/pessoas-e-acesso/funcoes/nova"]}>
        <Routes>
          <Route path="/pessoas-e-acesso/funcoes/nova" element={<RoleCreatePage />} />
          <Route path="/pessoas-e-acesso/funcoes/:id" element={<p>Editor</p>} />
          <Route path="/pessoas-e-acesso" element={<p>Roles</p>} />
        </Routes>
      </MemoryRouter>
    </TestPermissionProvider>,
  )
}

describe("RoleCreatePage", () => {
  beforeEach(() => {
    createRoleMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("keeps continue disabled until the name has two characters", async () => {
    const user = userEvent.setup()
    renderPage()
    const submit = screen.getByRole("button", { name: i18n.t("peopleAccess.roleEditor.createContinue") })
    const cancel = screen.getByRole("button", { name: i18n.t("common.cancel") })
    expect(submit).toBeDisabled()
    expect(cancel).toBeEnabled()

    const name = screen.getByLabelText(i18n.t("peopleAccess.role"))
    await user.type(name, "A")
    expect(submit).toBeDisabled()
    expect(createRoleMock).not.toHaveBeenCalled()

    await user.type(name, "b")
    expect(submit).toBeEnabled()
    await user.clear(name)
    expect(submit).toBeDisabled()
  })

  it("keeps the typed role after a server error and then opens the editor", async () => {
    const user = userEvent.setup()
    let rejectCreate: (reason: Error) => void = () => {
      throw new Error("missing reject")
    }
    createRoleMock.mockImplementation(
      () => new Promise((_resolve, reject) => {
        rejectCreate = reject
      }),
    )
    renderPage()
    const name = screen.getByLabelText(i18n.t("peopleAccess.role"))
    const description = screen.getByLabelText(i18n.t("peopleAccess.roles.descriptionLabel"))
    await user.type(name, "Portaria")
    await user.type(description, "Entrada")
    const submit = screen.getByRole("button", { name: i18n.t("peopleAccess.roleEditor.createContinue") })
    await user.click(submit)
    await waitFor(() => expect(submit).toBeDisabled())

    rejectCreate(new Error("Nome já cadastrado."))

    await waitFor(() => expect(submit).toBeEnabled())
    expect(toast.error).toHaveBeenCalledWith("Nome já cadastrado.")
    expect(name).toHaveValue("Portaria")
    expect(description).toHaveValue("Entrada")

    createRoleMock.mockResolvedValueOnce({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      name: "Portaria",
      description: "Entrada",
      isSystemRole: false,
      permissionKeys: [],
    })
    await user.click(submit)
    expect(await screen.findByText("Editor")).toBeInTheDocument()
    expect(createRoleMock).toHaveBeenLastCalledWith({
      name: "Portaria",
      description: "Entrada",
      permissionKeys: [],
    })
  })

  it("redirects to the editor after create on a data router", async () => {
    const user = userEvent.setup()
    createRoleMock.mockResolvedValue({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      name: "Portaria",
      description: null,
      isSystemRole: false,
      permissionKeys: [],
    })
    const router = createMemoryRouter([
      { path: "/pessoas-e-acesso/funcoes/nova", element: <RoleCreatePage /> },
      { path: "/pessoas-e-acesso/funcoes/:id", element: <p>Editor</p> },
    ], { initialEntries: ["/pessoas-e-acesso/funcoes/nova"] })
    render(
      <TestPermissionProvider permissions={["core.roles.manage"]}>
        <RouterProvider router={router} />
      </TestPermissionProvider>,
    )
    await user.type(screen.getByLabelText(i18n.t("peopleAccess.role")), "Portaria")
    await user.click(screen.getByRole("button", { name: i18n.t("peopleAccess.roleEditor.createContinue") }))
    expect(await screen.findByText("Editor")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/pessoas-e-acesso/funcoes/ffffffff-ffff-4fff-8fff-ffffffffffff")
  })

  it("asks before leaving a typed name and stays when cancel is chosen", async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter([
      { path: "/pessoas-e-acesso/funcoes/nova", element: <RoleCreatePage /> },
      { path: "/pessoas-e-acesso", element: <p>Roles</p> },
    ], { initialEntries: ["/pessoas-e-acesso/funcoes/nova"] })
    render(
      <TestPermissionProvider permissions={["core.roles.manage"]}>
        <RouterProvider router={router} />
      </TestPermissionProvider>,
    )
    await user.type(screen.getByLabelText(i18n.t("peopleAccess.role")), "Ab")
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    const dialog = await screen.findByRole("alertdialog")
    expect(router.state.location.pathname).toBe("/pessoas-e-acesso/funcoes/nova")
    await user.click(within(dialog).getByRole("button", { name: i18n.t("common.cancel") }))
    expect(router.state.location.pathname).toBe("/pessoas-e-acesso/funcoes/nova")
    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: i18n.t("fullPage.leave") }))
    expect(await screen.findByText("Roles")).toBeInTheDocument()
  })
})
