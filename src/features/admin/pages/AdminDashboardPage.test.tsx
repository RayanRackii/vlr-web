import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminDashboardPage } from "@/features/admin/pages/AdminDashboardPage"
import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
import {
  deleteAdminTenant,
  enterTenantEnvironment,
  listAdminTenants,
} from "@/features/admin/services/adminTenantsService"
import { getBillingSummary } from "@/features/billing/services/billingService"
import i18n from "@/lib/i18n"

const navigateMock = vi.hoisted(() => vi.fn())
const sessionMocks = vi.hoisted(() => ({
  clearPlatformTenantExited: vi.fn(),
  refreshAuthSession: vi.fn().mockResolvedValue(undefined),
  writeActiveTenantLabel: vi.fn(),
}))

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigateMock,
}))
vi.mock("@/features/admin/hooks/usePlatformTenantSession", () => sessionMocks)
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/billing/services/billingService", () => ({
  getBillingSummary: vi.fn(),
}))
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
    activeModules: ["Rentals", "Catalog", "Inventory", "Pmoc", "Assets"].map((moduleName) => ({
      moduleName,
      isActive: true,
    })) as TenantAdmin["activeModules"],
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

function table() {
  return screen.getByRole("table", { name: i18n.t("admin.dashboard.title") })
}

function tableRow(name: string) {
  return within(table()).getByRole("row", { name: new RegExp(name) })
}

function queryTableRow(name: string) {
  return within(table()).queryByRole("row", { name: new RegExp(name) })
}

function renderPage() {
  return render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>)
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.mocked(listAdminTenants).mockReset().mockResolvedValue(tenants)
    vi.mocked(deleteAdminTenant).mockReset().mockResolvedValue(undefined)
    vi.mocked(getBillingSummary).mockReset().mockResolvedValue({
      currency: "BRL",
      mrrCents: 123400,
      trialingCount: 3,
      activeCount: 5,
      pastDueCount: 1,
      readOnlyCount: 2,
      byPackage: [],
    })
    vi.mocked(enterTenantEnvironment)
      .mockReset()
      .mockResolvedValue({ legalName: "Estúdio Aurora" } as never)
    navigateMock.mockReset()
    Object.values(sessionMocks).forEach((mock) => mock.mockClear())
  })

  it("filters loaded tenants by name or subdomain and clears an empty search without fetching again", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("table")
    const search = screen.getByRole("searchbox", { name: i18n.t("admin.dashboard.searchLabel") })

    await user.type(search, "  AURORA  ")
    expect(tableRow("Estúdio Aurora")).toBeInTheDocument()
    expect(queryTableRow("Espaço Horizonte")).not.toBeInTheDocument()
    expect(queryTableRow("Consultoria Central")).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "STUDIO-")
    expect(tableRow("Estúdio Aurora")).toBeInTheDocument()
    expect(queryTableRow("Espaço Horizonte")).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "inexistente")
    expect(screen.getByText(i18n.t("admin.dashboard.searchEmptyTitle"))).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: i18n.t("admin.dashboard.clearSearch") }))

    expect(search).toHaveValue("")
    expect(tableRow("Estúdio Aurora")).toBeInTheDocument()
    expect(tableRow("Espaço Horizonte")).toBeInTheDocument()
    expect(tableRow("Consultoria Central")).toBeInTheDocument()
    expect(listAdminTenants).toHaveBeenCalledTimes(1)
  })

  it("shows the MRR from the billing summary, not an estimate from active modules", async () => {
    renderPage()
    await screen.findByRole("table")

    await waitFor(() => {
      expect(screen.getByTestId("admin-mrr")).toHaveTextContent(/R\$\s?1\.234/)
    })
    expect(screen.getByText(i18n.t("admin.dashboard.metrics.mrr"))).toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("admin.dashboard.metrics.mrrBreakdown", {
          active: 5,
          trialing: 3,
          pastDue: 1,
          readOnly: 2,
        }),
      ),
    ).toBeInTheDocument()
    // 5 modules x R$ 199 would have been the old estimate.
    expect(screen.queryByText(/995/)).not.toBeInTheDocument()
  })

  it("keeps the page working when the billing summary fails", async () => {
    vi.mocked(getBillingSummary).mockRejectedValue(new Error("boom"))
    renderPage()
    await screen.findByRole("table")

    expect(await screen.findByText(i18n.t("admin.dashboard.metrics.mrrUnavailable"))).toBeInTheDocument()
    expect(tableRow("Estúdio Aurora")).toBeInTheDocument()
  })

  it("recovers from a network failure using retry", async () => {
    vi.mocked(listAdminTenants).mockRejectedValueOnce(new Error("Network Error"))
    const user = userEvent.setup()
    renderPage()

    const error = await screen.findByRole("alert")
    expect(within(error).getByText(i18n.t("admin.errors.loadFailed"))).toBeInTheDocument()
    expect(screen.queryByText(i18n.t("admin.dashboard.emptyTitle"))).not.toBeInTheDocument()
    await user.click(within(error).getByRole("button", { name: i18n.t("common.retry") }))

    await screen.findByRole("table")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("lists tenants with the client, modules, document and status columns", async () => {
    renderPage()
    await screen.findByRole("table")

    const headers = within(table()).getAllByRole("columnheader").map((header) => header.textContent)
    expect(headers).toEqual([
      i18n.t("admin.dashboard.columns.client"),
      i18n.t("admin.dashboard.columns.modules"),
      i18n.t("admin.dashboard.taxId"),
      i18n.t("admin.dashboard.columns.status"),
      i18n.t("admin.dashboard.columns.actions"),
    ])

    const aurora = tableRow("Estúdio Aurora")
    expect(within(aurora).getByText("studio-aurora")).toBeInTheDocument()
    expect(within(aurora).getByText("123456789")).toBeInTheDocument()
    expect(within(aurora).getByText(i18n.t("admin.dashboard.statusActive"))).toBeInTheDocument()
    // Three module badges at most, then "+N" for the rest.
    expect(within(aurora).getByText("+2")).toBeInTheDocument()
    expect(
      within(tableRow("Consultoria Central")).getByText(i18n.t("admin.dashboard.noSubdomain")),
    ).toBeInTheDocument()
  })

  it("renders a card list for small screens", async () => {
    renderPage()
    const list = await screen.findByRole("list", { name: i18n.t("admin.dashboard.title") })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
  })

  it("filters by status chips", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("table")

    await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("admin.dashboard.statusInactive")) }))
    expect(tableRow("Espaço Horizonte")).toBeInTheDocument()
    expect(queryTableRow("Estúdio Aurora")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: new RegExp(i18n.t("admin.dashboard.filterAll")) }))
    expect(tableRow("Estúdio Aurora")).toBeInTheDocument()
  })

  it("enters the tenant environment with the same flow as before", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("table")

    const enterName = i18n.t("admin.dashboard.actions.openEnvironment")
    await user.click(within(tableRow("Estúdio Aurora")).getByRole("button", { name: enterName }))

    expect(enterTenantEnvironment).toHaveBeenCalledWith(tenants[0].id)
    await vi.waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/dashboard", { replace: true }),
    )
    expect(sessionMocks.clearPlatformTenantExited).toHaveBeenCalled()
    expect(sessionMocks.writeActiveTenantLabel).toHaveBeenCalledWith("Estúdio Aurora")
    expect(sessionMocks.refreshAuthSession).toHaveBeenCalled()
    expect(
      within(tableRow("Espaço Horizonte")).getByRole("button", { name: enterName }),
    ).toBeDisabled()
  })

  it("routes edit and visual resources from the row menu", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("table")

    const menuName = i18n.t("admin.dashboard.actions.rowMenu", { name: "Estúdio Aurora" })
    await user.click(within(table()).getByRole("button", { name: menuName }))
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("admin.dashboard.actions.edit") }))
    expect(navigateMock).toHaveBeenCalledWith(`/admin/tenants/${tenants[0].id}/edit`)

    await user.click(within(table()).getByRole("button", { name: menuName }))
    await user.click(
      await screen.findByRole("menuitem", { name: i18n.t("admin.dashboard.actions.visualResources") }),
    )
    expect(navigateMock).toHaveBeenCalledWith(`/admin/tenants/${tenants[0].id}/recursos-visuais`)
  })

  it("keeps the delete confirmation before deleting from the row menu", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("table")

    const menuName = i18n.t("admin.dashboard.actions.rowMenu", { name: "Estúdio Aurora" })
    await user.click(within(table()).getByRole("button", { name: menuName }))
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("admin.dashboard.actions.delete") }))

    const dialog = await screen.findByRole("alertdialog")
    expect(deleteAdminTenant).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: i18n.t("admin.dashboard.delete.confirm") }))

    await vi.waitFor(() => expect(deleteAdminTenant).toHaveBeenCalledWith(tenants[0].id))
    await screen.findByText(i18n.t("admin.dashboard.delete.success"))
    expect(queryTableRow("Estúdio Aurora")).not.toBeInTheDocument()
  })
})
