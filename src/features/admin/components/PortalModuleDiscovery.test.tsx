import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PortalModuleDiscovery } from "@/features/admin/components/PortalModuleDiscovery"
import { listAdminModules } from "@/features/admin/services/adminModulesService"
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

const listModulesMock = vi.mocked(listAdminModules)

function renderExplore(activeModules: readonly string[] = ["rentals"]) {
  return render(
    <TestPermissionProvider activeModules={activeModules}>
      <PortalModuleDiscovery />
    </TestPermissionProvider>,
  )
}

describe("PortalModuleDiscovery", () => {
  beforeEach(() => {
    listModulesMock.mockReset()
    listModulesMock.mockResolvedValue(FIVE_COMMERCIAL_MODULES)
  })

  it("lists commercial modules from GET /api/admin/modules", async () => {
    renderExplore(["rentals"])

    expect(
      await screen.findByText(i18n.t("admin.modules.Rentals")),
    ).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.Catalog"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.PMOC"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.Inventory"))).toBeInTheDocument()
    expect(screen.getByText(i18n.t("admin.modules.OS"))).toBeInTheDocument()
    expect(listModulesMock).toHaveBeenCalled()
  })

  it("does not render a maintenance card even when the payload includes it", async () => {
    listModulesMock.mockResolvedValue([
      ...FIVE_COMMERCIAL_MODULES,
      {
        key: "maintenance",
        isCommercial: false,
        isLegacy: true,
        provides: [],
        requiredCapabilities: [],
        aliases: [],
      },
    ])
    renderExplore()

    expect(
      await screen.findByText(i18n.t("admin.modules.Rentals")),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Manutenção$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Maintenance$/i)).not.toBeInTheDocument()
  })

  it("still shows an unknown commercial key from the API", async () => {
    listModulesMock.mockResolvedValue([
      ...FIVE_COMMERCIAL_MODULES,
      {
        key: "billing",
        isCommercial: true,
        isLegacy: false,
        provides: [],
        requiredCapabilities: [],
        aliases: [],
      },
    ])
    renderExplore()

    expect(await screen.findByText("billing")).toBeInTheDocument()
  })

  it("shows error and retry when the catalog fails", async () => {
    listModulesMock
      .mockRejectedValueOnce(new Error("falha do catálogo"))
      .mockResolvedValue(FIVE_COMMERCIAL_MODULES)
    const user = userEvent.setup()
    renderExplore()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "falha do catálogo",
    )

    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.modules.retry") }),
    )

    expect(
      await screen.findByText(i18n.t("admin.modules.Rentals")),
    ).toBeInTheDocument()
  })
})
