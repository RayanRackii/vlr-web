import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
import { listAdminTenants } from "@/features/admin/services/adminTenantsService"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/services/adminTenantsService", () => ({
  listAdminTenants: vi.fn(),
  deleteAdminTenant: vi.fn(),
  enterTenantEnvironment: vi.fn(),
}))

const tenants: TenantAdmin[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    legalName: "Estúdio Aurora",
    subdomain: "studio-aurora",
    taxId: "123456789",
    isActive: true,
    createdAt: "2026-10-28T12:00:00Z",
    activeModules: [],
    assetFamilyKeys: [],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    legalName: "Espaço Horizonte",
    subdomain: "horizonte",
    taxId: "987654321",
    isActive: false,
    createdAt: "2026-10-28T12:00:00Z",
    activeModules: [],
    assetFamilyKeys: [],
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    legalName: "Consultoria Central",
    subdomain: null,
    taxId: "456789123",
    isActive: true,
    createdAt: "2026-10-28T12:00:00Z",
    activeModules: [],
    assetFamilyKeys: [],
  },
]

function renderPage() {
  return render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>)
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(listAdminTenants).mockReset().mockResolvedValue(tenants)
  })

  it("filters loaded tenants by name or subdomain and clears an empty search without fetching again", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText("Estúdio Aurora")
    const search = screen.getByRole("searchbox", { name: i18n.t("admin.dashboard.searchLabel") })

    await user.type(search, "  AURORA  ")
    expect(screen.getByText("Estúdio Aurora")).toBeInTheDocument()
    expect(screen.queryByText("Espaço Horizonte")).not.toBeInTheDocument()
    expect(screen.queryByText("Consultoria Central")).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "STUDIO-")
    expect(screen.getByText("Estúdio Aurora")).toBeInTheDocument()
    expect(screen.queryByText("Espaço Horizonte")).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "inexistente")
    const empty = screen.getByRole("status")
    expect(within(empty).getByText(i18n.t("admin.dashboard.searchEmptyTitle"))).toBeInTheDocument()
    // The Clear button sits outside the live region so it is not announced as status text.
    expect(within(empty).queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByText("Estúdio Aurora")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("admin.dashboard.clearSearch") }))

    expect(search).toHaveValue("")
    expect(screen.getByText("Estúdio Aurora")).toBeInTheDocument()
    expect(screen.getByText("Espaço Horizonte")).toBeInTheDocument()
    expect(screen.getByText("Consultoria Central")).toBeInTheDocument()
    expect(listAdminTenants).toHaveBeenCalledTimes(1)
  })

  it("recovers from a network failure using retry", async () => {
    vi.mocked(listAdminTenants).mockRejectedValueOnce(new Error("Network Error"))
    const user = userEvent.setup()
    renderPage()

    const error = await screen.findByRole("alert")
    expect(within(error).getByText(i18n.t("admin.errors.loadFailed"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("admin.dashboard.emptyTitle"))).not.toBeInTheDocument()
    await user.click(within(error).getByRole("button", { name: i18n.t("common.retry") }))

    await screen.findByText("Estúdio Aurora")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
