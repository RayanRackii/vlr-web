import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PortalModuleDiscovery } from "@/features/admin/components/PortalModuleDiscovery"
import { listAdminModules } from "@/features/admin/services/adminModulesService"
import {
  getEligiblePortalMenuModules,
  PORTAL_CUSTOMER_MODULES,
} from "@/features/catalog/customerNav"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

vi.mock("@/features/admin/services/adminModulesService", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/services/adminModulesService")
  >("@/features/admin/services/adminModulesService")
  return {
    ...actual,
    listAdminModules: vi.fn(),
  }
})

const listModulesMock = vi.mocked(listAdminModules)

function renderExplore(activeModules: readonly string[] = ["rentals"]) {
  return render(
    <TestPermissionProvider activeModules={activeModules}>
      <PortalModuleDiscovery />
    </TestPermissionProvider>,
  )
}

function moduleCard(name: string) {
  const card = screen.getByText(name).closest("li")
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Card for ${name} was not rendered.`)
  }
  return card
}

describe("PortalModuleDiscovery", () => {
  beforeEach(() => {
    listModulesMock.mockReset()
    listModulesMock.mockRejectedValue(new Error("PlatformAdmin-only catalog"))
  })

  it("does not call GET /api/admin/modules", () => {
    renderExplore(["rentals"])

    expect(listModulesMock).not.toHaveBeenCalled()
  })

  it("lists the commercial presentation modules", () => {
    renderExplore(["rentals"])

    expect(screen.getByText(i18n.t("admin.modules.Inventory"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.PMOC"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.OS"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.Rentals"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.Catalog"))).toBeInTheDocument()
  })

  it("does not show maintenance as a normal available module", () => {
    renderExplore(["rentals", "maintenance"])

    expect(screen.queryByText(/^Manutenção$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Maintenance$/i)).not.toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("admin.modules.legacyMaintenanceNote")),
    ).not.toBeInTheDocument()
  })

  it("does not show asset-registry", () => {
    renderExplore(["rentals", "asset-registry"])

    expect(screen.queryByText(/asset-registry/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Asset Registry/i)).not.toBeInTheDocument()
  })

  it("marks badges from activeModules, not from a catalog GET", () => {
    renderExplore(["rentals"])

    expect(
      within(moduleCard(i18n.t("admin.modules.Rentals"))).getByText(
        i18n.t("admin.moduleMenu.stateActive"),
      ),
    ).toBeInTheDocument()
    expect(
      within(moduleCard(i18n.t("admin.modules.Catalog"))).getByText(
        i18n.t("admin.moduleMenu.stateAvailable"),
      ),
    ).toBeInTheDocument()
    expect(
      within(moduleCard(i18n.t("admin.modules.Inventory"))).getByText(
        i18n.t("admin.moduleMenu.stateAvailable"),
      ),
    ).toBeInTheDocument()
  })

  it("does not derive B2C eligibility; portal menu stays rentals/catalog", () => {
    renderExplore(["inventory"])

    expect(PORTAL_CUSTOMER_MODULES).toEqual(["rentals", "catalog"])
    expect(getEligiblePortalMenuModules(["inventory"])).toEqual([])

    expect(
      within(moduleCard(i18n.t("admin.modules.Inventory"))).getByText(
        i18n.t("admin.moduleMenu.stateActive"),
      ),
    ).toBeInTheDocument()
    expect(
      within(moduleCard(i18n.t("admin.modules.PMOC"))).getByText(
        i18n.t("admin.moduleMenu.stateAvailable"),
      ),
    ).toBeInTheDocument()
    expect(
      within(moduleCard(i18n.t("admin.modules.OS"))).getByText(
        i18n.t("admin.moduleMenu.stateAvailable"),
      ),
    ).toBeInTheDocument()
    expect(
      within(moduleCard(i18n.t("admin.modules.Rentals"))).getByText(
        i18n.t("admin.moduleMenu.stateAvailable"),
      ),
    ).toBeInTheDocument()
    expect(
      within(moduleCard(i18n.t("admin.modules.Catalog"))).getByText(
        i18n.t("admin.moduleMenu.stateAvailable"),
      ),
    ).toBeInTheDocument()
  })
})
