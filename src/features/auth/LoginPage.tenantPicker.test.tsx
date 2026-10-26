import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginPage } from "@/features/auth/LoginPage"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  StaffTenantError,
  listMyStaffTenants,
  selectMyStaffTenant,
} from "@/features/users/services/staffTenantsService"

vi.mock("@/features/users/services/staffTenantsService", async (orig) => ({
  ...(await orig<object>()),
  listMyStaffTenants: vi.fn(),
  selectMyStaffTenant: vi.fn(),
}))
vi.mock("sonner", async (orig) => ({
  ...(await orig<object>()),
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock("@/features/admin/hooks/usePlatformTenantSession", async (orig) => ({
  ...(await orig<object>()),
  refreshAuthSession: vi.fn().mockResolvedValue(undefined),
}))

const tenantA = "11111111-1111-4111-8111-111111111111"
const tenantB = "22222222-2222-4222-8222-222222222222"

function membership(tenantId: string, tradeName: string) {
  return {
    tenantId,
    legalName: `${tradeName} Ltda`,
    tradeName,
  } as never
}

function renderLogin(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
        <Route path="/os" element={<div>orders</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("E-mail"), "admin@clube.com")
  await user.type(screen.getByLabelText("Senha"), "password1")
  await user.click(screen.getByRole("button", { name: "Entrar" }))
  return user
}

describe("LoginPage tenant selector", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signInWithPassword).mockReset()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "1" }, session: {} },
      error: null,
    } as never)
    vi.mocked(listMyStaffTenants).mockReset()
    vi.mocked(selectMyStaffTenant).mockReset()
  })

  it("asks multi-tenant accounts which tenant to open", async () => {
    vi.mocked(listMyStaffTenants).mockResolvedValue({
      memberships: [membership(tenantA, "Alpha"), membership(tenantB, "Beta")],
      accessTokenTenantId: tenantA,
    } as never)
    vi.mocked(selectMyStaffTenant).mockResolvedValue({} as never)
    renderLogin()
    const user = await submit()

    expect(await screen.findByText("Beta")).toBeInTheDocument()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    await user.click(screen.getByText("Beta"))
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(selectMyStaffTenant).toHaveBeenCalledWith(tenantB)
  })

  it("keeps single-tenant accounts on the direct flow", async () => {
    vi.mocked(listMyStaffTenants).mockResolvedValue({
      memberships: [membership(tenantA, "Alpha")],
      accessTokenTenantId: tenantA,
    } as never)
    renderLogin()
    await submit()
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(selectMyStaffTenant).not.toHaveBeenCalled()
  })

  it("keeps platform admins on the direct flow", async () => {
    vi.mocked(listMyStaffTenants).mockRejectedValue(
      new StaffTenantError("PLATFORM_ADMIN_USES_ENTER", 409),
    )
    renderLogin()
    await submit()
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
  })

  const two = {
    memberships: [membership(tenantA, "Alpha"), membership(tenantB, "Beta")],
    accessTokenTenantId: tenantB,
  }

  it("preselects the token tenant and keeps next after picking", async () => {
    vi.mocked(listMyStaffTenants).mockResolvedValue(two as never)
    vi.mocked(selectMyStaffTenant).mockResolvedValue({} as never)
    renderLogin("/login?next=/os")
    const user = await submit()
    const radios = await screen.findAllByRole("radio")
    expect(radios[1]).toBeChecked()
    expect(radios[0]).not.toBeChecked()
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    expect(await screen.findByText("orders")).toBeInTheDocument()
    expect(selectMyStaffTenant).toHaveBeenCalledWith(tenantB)
  })

  it("shows an error toast and stays on the picker when selection fails", async () => {
    vi.mocked(listMyStaffTenants).mockResolvedValue(two as never)
    vi.mocked(selectMyStaffTenant).mockRejectedValue(
      new StaffTenantError("SERVER_ERROR", 500),
    )
    renderLogin()
    const user = await submit()
    await screen.findAllByRole("radio")
    await user.click(screen.getByRole("button", { name: "Continuar" }))
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
  })

  it("does not open any tenant when the lookup fails, and retries", async () => {
    vi.mocked(listMyStaffTenants)
      .mockRejectedValueOnce(new StaffTenantError("SERVER_ERROR", 500))
      .mockResolvedValueOnce(two as never)
    renderLogin()
    const user = await submit()
    expect(
      await screen.findByText(
        "Não foi possível carregar seus ambientes. Tente novamente.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }))
    expect(await screen.findAllByRole("radio")).toHaveLength(2)
  })
})
