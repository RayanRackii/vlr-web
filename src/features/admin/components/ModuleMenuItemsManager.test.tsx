import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useLocation } from "react-router-dom"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ModuleMenuItemsManager } from "@/features/admin/components/ModuleMenuItemsManager"
import { TenantModuleMenuPage } from "@/features/admin/pages/TenantModuleMenuPage"
import type { ModuleMenuItem } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import {
  createModuleMenuItem,
  deleteModuleMenuItem,
  fetchPortalRentalAssets,
  fetchTenantBranding,
  listTenantModuleMenuItems,
  updateModuleMenuItem,
} from "@/features/tenantPortal/services/tenantPortalService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import { api } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/features/tenantPortal/services/tenantPortalService", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/tenantPortal/services/tenantPortalService")
  >("@/features/tenantPortal/services/tenantPortalService")
  return {
    ...actual,
    listTenantModuleMenuItems: vi.fn(),
    listAdminModuleMenuItems: vi.fn(),
    createModuleMenuItem: vi.fn(),
    updateModuleMenuItem: vi.fn(),
    deleteModuleMenuItem: vi.fn(),
    fetchPortalRentalAssets: vi.fn(),
    fetchTenantBranding: vi.fn(),
  }
})

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}))

const WRITE_PERMS = ["core.module_menu.write"] as const
const ACTIVE_MODULES = ["rentals", "catalog"] as const

const RENTALS_ITEM: ModuleMenuItem = {
  id: "11111111-1111-4111-8111-111111111111",
  moduleName: "rentals",
  label: "Quadra 1",
  sortOrder: 0,
  isActive: true,
  rentalAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}

const CATALOG_ITEM: ModuleMenuItem = {
  id: "22222222-2222-4222-8222-222222222222",
  moduleName: "catalog",
  label: "Loja custom",
  sortOrder: 10,
  isActive: true,
  rentalAssetId: null,
}

const INVENTORY_ITEM: ModuleMenuItem = {
  id: "33333333-3333-4333-8333-333333333333",
  moduleName: "inventory",
  label: "Ativos",
  sortOrder: 20,
  isActive: true,
  rentalAssetId: null,
}

const INACTIVE_ITEM: ModuleMenuItem = {
  id: "44444444-4444-4444-8444-444444444444",
  moduleName: "rentals",
  label: "Horário extra",
  sortOrder: 30,
  isActive: false,
  rentalAssetId: null,
}

const listMock = vi.mocked(listTenantModuleMenuItems)
const createMock = vi.mocked(createModuleMenuItem)
const updateMock = vi.mocked(updateModuleMenuItem)
const deleteMock = vi.mocked(deleteModuleMenuItem)
const assetsMock = vi.mocked(fetchPortalRentalAssets)
const brandingMock = vi.mocked(fetchTenantBranding)
const apiGetMock = vi.mocked(api.get)

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-path">{location.pathname}</div>
}

function renderManager(
  options: {
    canWrite?: boolean
    activeModules?: readonly string[]
    items?: ModuleMenuItem[]
  } = {},
) {
  listMock.mockResolvedValue(options.items ?? [])
  return render(
    <MemoryRouter initialEntries={["/configuracoes/menu"]}>
      <ModuleMenuItemsManager
        activeModules={options.activeModules ?? ACTIVE_MODULES}
        canWrite={options.canWrite ?? true}
      />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function listRow(label: string) {
  const row = screen
    .getAllByText(label)
    .map((node) => node.closest("li"))
    .find((node) => node !== null)
  if (!row) {
    throw new Error("Row was not rendered.")
  }
  return row
}

async function waitForLoaded() {
  await waitFor(() => {
    expect(listMock).toHaveBeenCalled()
  })
  await waitFor(() => {
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
}

describe("ModuleMenuItemsManager", () => {
  beforeEach(() => {
    listMock.mockReset()
    createMock.mockReset()
    updateMock.mockReset()
    deleteMock.mockReset()
    assetsMock.mockReset()
    brandingMock.mockReset()
    apiGetMock.mockReset()
    listMock.mockResolvedValue([])
    createMock.mockResolvedValue(RENTALS_ITEM)
    updateMock.mockResolvedValue(RENTALS_ITEM)
    deleteMock.mockResolvedValue(undefined)
    assetsMock.mockResolvedValue([])
    brandingMock.mockRejectedValue(new Error("no branding"))
    apiGetMock.mockResolvedValue({ data: [] })
  })

  it("shows an empty state and a first-item CTA", async () => {
    renderManager()
    await waitForLoaded()

    expect(
      screen.getByText(i18n.t("admin.moduleMenu.empty")),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    ).toBeInTheDocument()
  })

  it("lists items with friendly module and destination labels", async () => {
    apiGetMock.mockResolvedValue({
      data: [
        {
          id: RENTALS_ITEM.rentalAssetId,
          name: "Quadra de tênis",
        },
      ],
    })
    renderManager({
      items: [RENTALS_ITEM, CATALOG_ITEM, INVENTORY_ITEM, INACTIVE_ITEM],
    })
    await waitForLoaded()

    expect(screen.getAllByText("Quadra 1").length).toBeGreaterThan(0)
    expect(screen.getAllByText(i18n.t("admin.modules.Rentals")).length).toBeGreaterThan(0)
    expect(screen.getByText("Quadra de tênis", { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(RENTALS_ITEM.rentalAssetId ?? "")).not.toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.Catalog"))).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.moduleMenu.notInPortal")),
    ).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.moduleMenu.hidden"))).toBeInTheDocument()
  })

  it("shows the inactive-module badge when the tenant module is off", async () => {
    renderManager({
      items: [RENTALS_ITEM],
      activeModules: ["catalog"],
    })
    await waitForLoaded()

    expect(
      screen.getByText(i18n.t("admin.moduleMenu.inactiveModule")),
    ).toBeInTheDocument()
  })

  it("creates a rentals item with canonical moduleName", async () => {
    const user = userEvent.setup()
    renderManager()
    await waitForLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const functionality = within(dialog).getByLabelText(
      i18n.t("admin.moduleMenu.functionality"),
    )
    expect(functionality).toHaveValue("rentals")
    expect(
      within(functionality).queryByRole("option", { name: "Rentals" }),
    ).not.toBeInTheDocument()

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.moduleMenu.create"),
      }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleName: "rentals",
          label: i18n.t("admin.moduleMenu.suggestedLabelRentals"),
          isActive: true,
          rentalAssetId: null,
        }),
        undefined,
      )
    })
    expect(createMock.mock.calls[0]?.[0]).not.toHaveProperty(
      "moduleName",
      "Rentals",
    )
  })

  it("creates a catalog item with moduleName catalog", async () => {
    const user = userEvent.setup()
    renderManager()
    await waitForLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    await user.selectOptions(
      within(dialog).getByLabelText(i18n.t("admin.moduleMenu.functionality")),
      "catalog",
    )
    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.moduleMenu.create"),
      }),
    )

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleName: "catalog",
        }),
        undefined,
      )
    })
  })

  it("updates an item without sending moduleName", async () => {
    const user = userEvent.setup()
    renderManager({ items: [RENTALS_ITEM] })
    await waitForLoaded()

    const row = listRow(RENTALS_ITEM.label)
    await user.click(
      within(row).getByRole("button", { name: i18n.t("common.edit") }),
    )

    const dialog = await screen.findByRole("dialog")
    const labelInput = within(dialog).getByLabelText(
      i18n.t("admin.moduleMenu.label"),
    )
    await user.clear(labelInput)
    await user.type(labelInput, "Quadra coberta")

    await user.click(
      within(dialog).getByRole("button", {
        name: i18n.t("admin.moduleMenu.save"),
      }),
    )

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled()
    })
    const body = updateMock.mock.calls[0]?.[1]
    expect(body).toEqual(
      expect.objectContaining({
        label: "Quadra coberta",
        isActive: true,
      }),
    )
    expect(body).not.toHaveProperty("moduleName")
  })

  it("confirms delete before calling the API", async () => {
    const user = userEvent.setup()
    renderManager({ items: [RENTALS_ITEM] })
    await waitForLoaded()

    const row = listRow(RENTALS_ITEM.label)
    await user.click(
      within(row).getByRole("button", { name: i18n.t("common.delete") }),
    )

    const confirm = await screen.findByRole("alertdialog")
    expect(
      within(confirm).getByText(
        i18n.t("admin.moduleMenu.deleteDescription", {
          label: RENTALS_ITEM.label,
        }),
      ),
    ).toBeInTheDocument()

    await user.click(
      within(confirm).getByRole("button", { name: i18n.t("common.delete") }),
    )

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith(RENTALS_ITEM.id, undefined)
    })
  })

  it("updates the preview while typing a rentals label", async () => {
    const user = userEvent.setup()
    renderManager()
    await waitForLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const labelInput = within(dialog).getByLabelText(
      i18n.t("admin.moduleMenu.label"),
    )
    await user.clear(labelInput)
    await user.type(labelInput, "Minha agenda")

    const preview = screen
      .getByText(i18n.t("admin.moduleMenu.previewCaption"))
      .closest("section")
    if (!preview) {
      throw new Error("Preview was not rendered.")
    }
    expect(
      within(preview).getByRole("button", {
        name: "Minha agenda",
        hidden: true,
      }),
    ).toBeInTheDocument()
  })

  it("does not navigate when a preview nav button is clicked", async () => {
    const user = userEvent.setup()
    renderManager({ items: [RENTALS_ITEM] })
    await waitForLoaded()

    const preview = screen
      .getByText(i18n.t("admin.moduleMenu.previewCaption"))
      .closest("section")
    if (!preview) {
      throw new Error("Preview was not rendered.")
    }

    await user.click(within(preview).getByRole("button", { name: RENTALS_ITEM.label }))

    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/configuracoes/menu",
    )
    expect(within(preview).queryByRole("link")).not.toBeInTheDocument()
  })

  it("offers only eligible modules in the create select", async () => {
    const user = userEvent.setup()
    renderManager({ activeModules: ["rentals"] })
    await waitForLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const functionality = within(dialog).getByLabelText(
      i18n.t("admin.moduleMenu.functionality"),
    )
    expect(functionality).toHaveValue("rentals")
    expect(
      within(functionality).getByRole("option", {
        name: i18n.t("admin.modules.Rentals"),
      }),
    ).toBeInTheDocument()
    expect(
      within(functionality).queryByRole("option", {
        name: i18n.t("admin.modules.Catalog"),
      }),
    ).not.toBeInTheDocument()
  })

  it("includes catalog in the create select when the module is active", async () => {
    const user = userEvent.setup()
    renderManager({ activeModules: ["catalog"] })
    await waitForLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    const functionality = within(dialog).getByLabelText(
      i18n.t("admin.moduleMenu.functionality"),
    )
    expect(functionality).toHaveValue("catalog")
    expect(
      within(functionality).getByRole("option", {
        name: i18n.t("admin.modules.Catalog"),
      }),
    ).toBeInTheDocument()
  })

  it("keeps an inactive catalog item in the list but out of the preview", async () => {
    renderManager({
      items: [CATALOG_ITEM],
      activeModules: ["rentals"],
    })
    await waitForLoaded()

    const row = listRow(CATALOG_ITEM.label)
    expect(
      within(row).getByText(i18n.t("admin.moduleMenu.inactiveModule")),
    ).toBeInTheDocument()

    const preview = screen
      .getByText(i18n.t("admin.moduleMenu.previewCaption"))
      .closest("section")
    if (!preview) {
      throw new Error("Preview was not rendered.")
    }
    expect(
      within(preview).queryByRole("button", {
        name: i18n.t("tenantPortal.catalog.navCatalog"),
        hidden: true,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(preview).queryByRole("button", {
        name: i18n.t("tenantPortal.catalog.navOrders"),
        hidden: true,
      }),
    ).not.toBeInTheDocument()
  })

  it("does not render discovery marketing cards under the builder", async () => {
    renderManager({
      items: [RENTALS_ITEM],
      activeModules: ["rentals"],
    })
    await waitForLoaded()

    expect(
      screen.queryByText(i18n.t("admin.moduleMenu.discoveryTitle")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("admin.moduleMenu.exploreTitle")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("admin.moduleMenu.discoveryCatalogBenefit")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", {
        name: i18n.t("admin.moduleMenu.discoverModule"),
      }),
    ).not.toBeInTheDocument()
  })

  it("hides display-name input for catalog and keeps it for rentals", async () => {
    const user = userEvent.setup()
    renderManager({ activeModules: ["rentals", "catalog"] })
    await waitForLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByLabelText(i18n.t("admin.moduleMenu.label")),
    ).toBeInTheDocument()

    await user.selectOptions(
      within(dialog).getByLabelText(i18n.t("admin.moduleMenu.functionality")),
      "catalog",
    )

    expect(
      within(dialog).queryByLabelText(i18n.t("admin.moduleMenu.label")),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByText(i18n.t("admin.moduleMenu.catalogAutoNav")),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(i18n.t("tenantPortal.catalog.navCatalog")),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(i18n.t("tenantPortal.catalog.navOrders")),
    ).toBeInTheDocument()
  })

  it("shows noEligible copy and hides add CTA when nothing is eligible", async () => {
    renderManager({ activeModules: ["inventory"] })
    await waitForLoaded()

    expect(
      screen.getByText(i18n.t("admin.moduleMenu.noEligibleFunctionality")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: i18n.t("admin.moduleMenu.add"),
      }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(i18n.t("admin.moduleMenu.functionality")),
    ).not.toBeInTheDocument()
  })
})

describe("TenantModuleMenuPage", () => {
  beforeEach(() => {
    listMock.mockReset()
    assetsMock.mockReset()
    brandingMock.mockReset()
    apiGetMock.mockReset()
    listMock.mockResolvedValue([])
    assetsMock.mockResolvedValue([])
    brandingMock.mockResolvedValue({
      subdomain: "clube",
      displayName: "Clube",
      logoSvg: null,
      primaryColor: "#111111",
      accentColor: "#222222",
      welcomeTagline: null,
    })
    apiGetMock.mockResolvedValue({ data: [] })
  })

  function renderPage(
    options: {
      activeModules?: readonly string[]
      items?: ModuleMenuItem[]
    } = {},
  ) {
    listMock.mockResolvedValue(options.items ?? [])
    return render(
      <MemoryRouter>
        <TestPermissionProvider
          permissions={WRITE_PERMS}
          activeModules={options.activeModules ?? ACTIVE_MODULES}
        >
          <TenantModuleMenuPage />
        </TestPermissionProvider>
      </MemoryRouter>,
    )
  }

  async function waitForPageLoaded() {
    await waitFor(() => {
      expect(listMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
  }

  it("uses the cadastro shell without extra padding", async () => {
    const { container } = renderPage()

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: i18n.t("admin.moduleMenu.tenantPageTitle"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.moduleMenu.tenantPageDescription")),
    ).toBeInTheDocument()
    expect(container.firstChild).toHaveClass(
      "mx-auto",
      "w-full",
      "max-w-7xl",
      "space-y-6",
    )
    expect(container.firstChild).not.toHaveClass("p-6")
  })

  it("shows the builder and preview on configuration, without explore heading", async () => {
    renderPage({ items: [] })
    await waitForPageLoaded()

    expect(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.tabs.configuration"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.tabs.explore"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.addFirst"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.moduleMenu.previewCaption")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.exploreTitle"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("admin.moduleMenu.discoveryTitle")),
    ).not.toBeInTheDocument()
  })

  it("opens explore with inactive Catalog and operations modules, without preview or CTAs", async () => {
    const user = userEvent.setup()
    renderPage({
      items: [RENTALS_ITEM],
      activeModules: ["rentals"],
    })
    await waitForPageLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.tabs.explore"),
      }),
    )

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.exploreTitle"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.title"),
      }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(i18n.t("admin.modules.PMOC")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.modules.Inventory")),
    ).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.OS"))).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.modules.Catalog")),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(i18n.t("admin.moduleMenu.stateAvailable")).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole("link", {
        name: i18n.t("admin.moduleMenu.discoverModule"),
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /ativar/i }),
    ).not.toBeInTheDocument()
  })

  it("keeps Catalog listed as Active when the module is already on", async () => {
    const user = userEvent.setup()
    renderPage({
      items: [RENTALS_ITEM, CATALOG_ITEM],
      activeModules: ["rentals", "catalog"],
    })
    await waitForPageLoaded()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.tabs.explore"),
      }),
    )

    const exploreRoot = screen
      .getByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.exploreTitle"),
      })
      .closest("div.space-y-6")
    if (!(exploreRoot instanceof HTMLElement)) {
      throw new Error("Explore surface was not rendered.")
    }
    const catalogName = await within(exploreRoot).findByText(
      i18n.t("admin.modules.Catalog"),
    )
    const card = catalogName.closest("li")
    if (!(card instanceof HTMLElement)) {
      throw new Error("Catalog card was not rendered.")
    }
    expect(
      within(card).getByText(i18n.t("admin.moduleMenu.stateActive")),
    ).toBeInTheDocument()
  })

  it("preserves the builder list when switching back from explore", async () => {
    const user = userEvent.setup()
    renderPage({
      items: [RENTALS_ITEM],
      activeModules: ["rentals"],
    })
    await waitForPageLoaded()

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.title"),
      }),
    ).toBeInTheDocument()
    expect(listRow(RENTALS_ITEM.label)).toBeInTheDocument()
    const callsBeforeExplore = listMock.mock.calls.length

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.tabs.explore"),
      }),
    )
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.exploreTitle"),
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.moduleMenu.tabs.configuration"),
      }),
    )

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: i18n.t("admin.moduleMenu.title"),
      }),
    ).toBeInTheDocument()
    expect(listRow(RENTALS_ITEM.label)).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("admin.moduleMenu.previewCaption")),
    ).toBeInTheDocument()
    expect(listMock.mock.calls.length).toBe(callsBeforeExplore)
  })
})
