import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { EditTenantPage } from "@/features/admin/pages/EditTenantPage"
import { listAdminModules } from "@/features/admin/services/adminModulesService"
import { getAdminTenant } from "@/features/admin/services/adminTenantsService"
import { listAdminAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
import {
  fetchPortalRentalAssets,
  fetchTenantBranding,
  listAdminModuleMenuItems,
  listAdminRegistrationFields,
} from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listAdminAssetFamilyCatalog: vi.fn(),
}))

vi.mock("@/features/admin/services/adminModulesService", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/services/adminModulesService")
  >("@/features/admin/services/adminModulesService")
  return {
    ...actual,
    listAdminModules: vi.fn(),
  }
})

vi.mock("@/features/admin/services/adminTenantsService", () => ({
  getAdminTenant: vi.fn(),
  updateAdminTenant: vi.fn(),
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/tenantPortal/services/tenantPortalService")
  >("@/features/tenantPortal/services/tenantPortalService")
  return {
    ...actual,
    listAdminRegistrationFields: vi.fn(),
    listAdminModuleMenuItems: vi.fn(),
    fetchPortalRentalAssets: vi.fn(),
    fetchTenantBranding: vi.fn(),
  }
})

vi.mock("@/features/admin/components/TenantUsersManager", () => ({
  TenantUsersManager: () => null,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))

const TENANT_ID = "11111111-1111-4111-8111-111111111111"

const FIVE_COMMERCIAL_MODULES = [
  {
    key: "inventory",
    isCommercial: true,
    isLegacy: false,
    provides: ["asset-registry"],
    requiredCapabilities: [],
    aliases: [],
  },
  {
    key: "pmoc",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: [],
  },
  {
    key: "os",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: [],
  },
  {
    key: "rentals",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: ["asset-registry"],
    aliases: [],
  },
  {
    key: "catalog",
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: [],
    aliases: ["orders"],
  },
]

const getAdminTenantMock = vi.mocked(getAdminTenant)
const listModulesMock = vi.mocked(listAdminModules)
const listFamiliesMock = vi.mocked(listAdminAssetFamilyCatalog)
const listRegistrationFieldsMock = vi.mocked(listAdminRegistrationFields)
const listMenuItemsMock = vi.mocked(listAdminModuleMenuItems)
const rentalAssetsMock = vi.mocked(fetchPortalRentalAssets)
const brandingMock = vi.mocked(fetchTenantBranding)

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={[`/admin/tenants/${TENANT_ID}/edit`]}>
      <Routes>
        <Route path="/admin/tenants/:id/edit" element={<EditTenantPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function moduleButton(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) })
}

describe("EditTenantPage Super-Admin edit without PermissionProvider", () => {
  beforeEach(() => {
    getAdminTenantMock.mockReset()
    getAdminTenantMock.mockResolvedValue({
      id: TENANT_ID,
      legalName: "Clube Acme",
      taxId: "12345",
      subdomain: "clube",
      isActive: true,
      createdAt: "2026-09-04T00:00:00.000Z",
      activeModules: [
        { moduleName: "rentals", isActive: true },
        { moduleName: "maintenance", isActive: true },
      ],
      assetFamilyKeys: ["spaces"],
    })
    listModulesMock.mockReset()
    listModulesMock.mockResolvedValue(FIVE_COMMERCIAL_MODULES)
    listFamiliesMock.mockReset()
    listFamiliesMock.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        key: "spaces",
        label: "Espaços",
        fields: [],
        sortOrder: 0,
        isActive: true,
      },
    ])
    listRegistrationFieldsMock.mockReset()
    listRegistrationFieldsMock.mockResolvedValue([])
    listMenuItemsMock.mockReset()
    listMenuItemsMock.mockResolvedValue([])
    rentalAssetsMock.mockReset()
    rentalAssetsMock.mockResolvedValue([])
    brandingMock.mockReset()
    brandingMock.mockRejectedValue(new Error("no branding"))
  })

  it("renders the target tenant form without wrapping PermissionProvider", async () => {
    renderEditPage()

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("admin.edit.title"),
      }),
    ).toBeInTheDocument()

    expect(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    ).toBeInTheDocument()
    expect(
      moduleButton(i18n.t("admin.modules.PMOC")),
    ).toBeInTheDocument()
    expect(moduleButton(i18n.t("admin.modules.OS"))).toBeInTheDocument()
    expect(
      moduleButton(i18n.t("admin.modules.Inventory")),
    ).toBeInTheDocument()
    expect(
      moduleButton(i18n.t("admin.modules.Catalog")),
    ).toBeInTheDocument()

    expect(moduleButton(i18n.t("admin.modules.Rentals"))).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(moduleButton(i18n.t("admin.modules.Inventory"))).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(moduleButton(i18n.t("admin.modules.PMOC"))).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(moduleButton(i18n.t("admin.modules.OS"))).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(moduleButton(i18n.t("admin.modules.Catalog"))).toHaveAttribute(
      "aria-pressed",
      "false",
    )

    expect(
      screen.getByText(i18n.t("admin.modules.legacyMaintenanceNote")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Manutenção$/i }),
    ).not.toBeInTheDocument()
  })
})
