import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantEditForm } from "@/features/admin/components/TenantEditForm"
import { listAdminModules } from "@/features/admin/services/adminModulesService"
import { updateAdminTenant } from "@/features/admin/services/adminTenantsService"
import type { TenantOnboardingFormValues } from "@/features/admin/schemas/adminTenantSchemas"
import { listAdminAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
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
  updateAdminTenant: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/admin/components/RegistrationFieldsManager", () => ({
  RegistrationFieldsManager: () => null,
}))

vi.mock("@/features/admin/components/ModuleMenuItemsManager", () => ({
  ModuleMenuItemsManager: () => null,
}))

vi.mock("@/features/admin/components/TenantUsersManager", () => ({
  TenantUsersManager: () => null,
}))

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

const initialValues: TenantOnboardingFormValues = {
  legalName: "Clube Acme",
  taxId: "123456789",
  subdomain: "acme",
  logoSvg: "",
  primaryColor: "#4D6A92",
  accentColor: "",
  welcomeTagline: "",
  activeModules: ["rentals"],
  assetFamilyKeys: ["spaces"],
  adminFullName: "",
  adminEmail: "",
}

const listFamiliesMock = vi.mocked(listAdminAssetFamilyCatalog)
const listModulesMock = vi.mocked(listAdminModules)
const updateAdminTenantMock = vi.mocked(updateAdminTenant)

function renderEdit(options?: { hasLegacyMaintenance?: boolean }) {
  return render(
    <MemoryRouter>
      <TenantEditForm
        tenantId="11111111-1111-4111-8111-111111111111"
        initialValues={initialValues}
        hasLegacyMaintenance={options?.hasLegacyMaintenance}
      />
    </MemoryRouter>,
  )
}

describe("TenantEditForm modules catalog", () => {
  beforeEach(() => {
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
    listModulesMock.mockReset()
    listModulesMock.mockResolvedValue(FIVE_COMMERCIAL_MODULES)
    updateAdminTenantMock.mockReset()
    updateAdminTenantMock.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      legalName: "Clube Acme",
      taxId: "123456789",
      subdomain: "acme",
      isActive: true,
      createdAt: "2026-09-04T00:00:00.000Z",
      activeModules: [{ moduleName: "rentals", isActive: true }],
      assetFamilyKeys: ["spaces"],
    })
  })

  it("does not add a selectable maintenance checkbox when the tenant already has legacy maintenance", async () => {
    renderEdit({ hasLegacyMaintenance: true })

    expect(
      await screen.findByText(i18n.t("admin.modules.legacyMaintenanceNote")),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Manutenção$/i }),
    ).not.toBeInTheDocument()
  })

  it("saves commercial selections without a maintenance key", async () => {
    const user = userEvent.setup()
    renderEdit({ hasLegacyMaintenance: true })

    await screen.findByRole("button", {
      name: new RegExp(i18n.t("admin.modules.Rentals")),
    })

    await user.click(
      screen.getByRole("button", {
        name: i18n.t("admin.edit.actions.save"),
      }),
    )

    await waitFor(() => {
      expect(updateAdminTenantMock).toHaveBeenCalled()
    })

    const payload = updateAdminTenantMock.mock.calls[0]?.[1]
    expect(payload?.activeModules).toEqual(["rentals"])
    expect(payload?.activeModules).not.toContain("maintenance")
    expect(payload?.activeModules).not.toContain("inventory")
  })

  it("disables Save and offers retry when the module catalog fails", async () => {
    listModulesMock.mockRejectedValue(new Error("falha do catálogo"))
    const user = userEvent.setup()
    renderEdit()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "falha do catálogo",
    )
    expect(
      screen.getByRole("button", {
        name: i18n.t("admin.edit.actions.save"),
      }),
    ).toBeDisabled()

    listModulesMock.mockResolvedValue(FIVE_COMMERCIAL_MODULES)
    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.modules.retry") }),
    )

    expect(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    ).toBeInTheDocument()
  })
})
