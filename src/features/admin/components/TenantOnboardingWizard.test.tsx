import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantOnboardingWizard } from "@/features/admin/components/TenantOnboardingWizard"
import { listAdminModules } from "@/features/admin/services/adminModulesService"
import { createAdminTenant } from "@/features/admin/services/adminTenantsService"
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
  createAdminTenant: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const CATALOG_FAMILY = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "spaces",
  label: "Espaços",
  fields: [],
  sortOrder: 0,
  isActive: true,
}

function commercialModule(
  key: string,
  overrides: Partial<{
    isCommercial: boolean
    isLegacy: boolean
    provides: string[]
    requiredCapabilities: string[]
    aliases: string[]
  }> = {},
) {
  return {
    key,
    isCommercial: true,
    isLegacy: false,
    provides: [],
    requiredCapabilities: [],
    aliases: [],
    ...overrides,
  }
}

const FIVE_COMMERCIAL_MODULES = [
  commercialModule("inventory", { provides: ["asset-registry"] }),
  commercialModule("pmoc", { requiredCapabilities: ["asset-registry"] }),
  commercialModule("os", { requiredCapabilities: ["asset-registry"] }),
  commercialModule("rentals", { requiredCapabilities: ["asset-registry"] }),
  commercialModule("catalog", { aliases: ["orders"] }),
]

const listFamiliesMock = vi.mocked(listAdminAssetFamilyCatalog)
const listModulesMock = vi.mocked(listAdminModules)
const createAdminTenantMock = vi.mocked(createAdminTenant)

function renderWizard() {
  return render(
    <MemoryRouter>
      <TenantOnboardingWizard />
    </MemoryRouter>,
  )
}

function nextButton() {
  return screen.getByRole("button", {
    name: i18n.t("admin.wizard.actions.next"),
  })
}

function backButton() {
  return screen.getByRole("button", {
    name: i18n.t("admin.wizard.actions.back"),
  })
}

function cancelButton() {
  return screen.getByRole("button", { name: i18n.t("common.cancel") })
}

function finishButton() {
  return screen.getByRole("button", {
    name: i18n.t("admin.wizard.actions.finish"),
  })
}

async function fillCompanyStep(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(
    screen.getByLabelText(i18n.t("admin.wizard.fields.legalName")),
    "Clube Acme",
  )
  await user.type(
    screen.getByLabelText(i18n.t("admin.wizard.fields.taxId")),
    "123456789",
  )
}

async function continueWhenEnabled(
  user: ReturnType<typeof userEvent.setup>,
) {
  await waitFor(() => {
    expect(nextButton()).toBeEnabled()
  })
  await user.click(nextButton())
}

async function fillThroughAdminInvite(
  user: ReturnType<typeof userEvent.setup>,
) {
  await fillCompanyStep(user)
  await continueWhenEnabled(user)

  await user.type(
    await screen.findByLabelText(i18n.t("admin.wizard.fields.subdomain")),
    "acme",
  )
  await continueWhenEnabled(user)

  await user.click(
    await screen.findByRole("button", {
      name: new RegExp(i18n.t("admin.modules.Rentals")),
    }),
  )
  await continueWhenEnabled(user)

  await user.click(
    await screen.findByRole("button", { name: /Espaços/ }),
  )
  await continueWhenEnabled(user)
}

describe("TenantOnboardingWizard", () => {
  beforeEach(() => {
    listFamiliesMock.mockReset()
    listFamiliesMock.mockResolvedValue([CATALOG_FAMILY])
    listModulesMock.mockReset()
    listModulesMock.mockResolvedValue(FIVE_COMMERCIAL_MODULES)
    createAdminTenantMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })

  it("shows the six company-wizard step labels on compact and vertical steppers", async () => {
    renderWizard()

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("admin.wizard.title"),
      }),
    ).toBeInTheDocument()

    const labels = [
      i18n.t("admin.wizard.stepShort.1"),
      i18n.t("admin.wizard.stepShort.2"),
      i18n.t("admin.wizard.stepShort.3"),
      i18n.t("admin.wizard.stepShort.4"),
      i18n.t("admin.wizard.stepShort.5"),
      i18n.t("admin.wizard.stepShort.6"),
    ]

    for (const label of labels) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }

    const steppers = screen.getAllByTestId("company-wizard-stepper")
    const variants = steppers.map((node) => node.getAttribute("data-variant"))

    expect(variants).toEqual(expect.arrayContaining(["vertical", "compact"]))
    expect(screen.getByText("Cadastrar nova empresa")).toBeInTheDocument()
  })

  it("starts with Continuar disabled and shows legalNameMin after touch", async () => {
    const user = userEvent.setup()
    renderWizard()

    expect(nextButton()).toBeDisabled()
    expect(cancelButton()).toBeEnabled()
    expect(backButton()).toBeDisabled()

    const legalName = screen.getByLabelText(
      i18n.t("admin.wizard.fields.legalName"),
    )
    await user.click(legalName)
    await user.tab()

    expect(
      await screen.findByText(i18n.t("admin.wizard.validation.legalNameMin")),
    ).toBeInTheDocument()
    expect(screen.queryByText("Invalid input")).not.toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })

  it("enables Continuar when step 1 is valid and disables it again if a field becomes invalid", async () => {
    const user = userEvent.setup()
    renderWizard()

    expect(nextButton()).toBeDisabled()

    await fillCompanyStep(user)

    await waitFor(() => {
      expect(nextButton()).toBeEnabled()
    })

    await user.clear(
      screen.getByLabelText(i18n.t("admin.wizard.fields.legalName")),
    )

    await waitFor(() => {
      expect(nextButton()).toBeDisabled()
    })
  })

  it("keeps Back and Cancel enabled on an invalid step after the first", async () => {
    const user = userEvent.setup()
    renderWizard()

    await fillCompanyStep(user)
    await continueWhenEnabled(user)

    expect(
      await screen.findByLabelText(i18n.t("admin.wizard.fields.subdomain")),
    ).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
    expect(backButton()).toBeEnabled()
    expect(cancelButton()).toBeEnabled()
  })

  it("shows a specific pt-BR message for a bad subdomain without enabling Continuar", async () => {
    const user = userEvent.setup()
    renderWizard()

    await fillCompanyStep(user)
    await continueWhenEnabled(user)

    const subdomain = await screen.findByLabelText(
      i18n.t("admin.wizard.fields.subdomain"),
    )
    await user.type(subdomain, "Bad_Sub")
    await user.tab()

    expect(
      await screen.findByText(i18n.t("admin.wizard.validation.subdomainFormat")),
    ).toBeInTheDocument()
    expect(screen.queryByText("Invalid input")).not.toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })

  it("disables Continuar on Recursos until a family is selected and shows familiesMin", async () => {
    const user = userEvent.setup()
    renderWizard()

    await fillCompanyStep(user)
    await continueWhenEnabled(user)

    await user.type(
      await screen.findByLabelText(i18n.t("admin.wizard.fields.subdomain")),
      "acme",
    )
    await continueWhenEnabled(user)

    await user.click(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    )
    await continueWhenEnabled(user)

    expect(
      await screen.findByText(i18n.t("admin.wizard.steps.families")),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(i18n.t("admin.wizard.validation.familiesMin")),
    ).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()

    await user.click(await screen.findByRole("button", { name: /Espaços/ }))

    await waitFor(() => {
      expect(nextButton()).toBeEnabled()
    })

    await user.click(screen.getByRole("button", { name: /Espaços/ }))

    await waitFor(() => {
      expect(nextButton()).toBeDisabled()
    })
  })

  it("keeps Continuar disabled on Recursos when the family catalog is empty", async () => {
    listFamiliesMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWizard()

    await fillCompanyStep(user)
    await continueWhenEnabled(user)

    await user.type(
      await screen.findByLabelText(i18n.t("admin.wizard.fields.subdomain")),
      "acme",
    )
    await continueWhenEnabled(user)

    await user.click(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    )
    await continueWhenEnabled(user)

    expect(
      await screen.findByText(i18n.t("admin.wizard.validation.familiesMin")),
    ).toBeInTheDocument()
    expect(nextButton()).toBeDisabled()
  })

  it("disables Finalizar while the create request is in flight", async () => {
    createAdminTenantMock.mockImplementation(
      () => new Promise(() => undefined),
    )
    const user = userEvent.setup()
    renderWizard()

    await fillThroughAdminInvite(user)
    await continueWhenEnabled(user)

    expect(
      await screen.findByText(i18n.t("admin.wizard.steps.summary")),
    ).toBeInTheDocument()
    expect(finishButton()).toBeEnabled()

    await user.click(finishButton())

    expect(
      await screen.findByRole("button", {
        name: i18n.t("admin.wizard.actions.finishing"),
      }),
    ).toBeDisabled()
  })

  it("stays on review and re-enables Finalizar after a server create error", async () => {
    createAdminTenantMock.mockRejectedValue(
      new Error("Subdomínio já está em uso."),
    )
    const user = userEvent.setup()
    renderWizard()

    await fillThroughAdminInvite(user)
    await continueWhenEnabled(user)

    await user.click(finishButton())

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(screen.getByText("Clube Acme")).toBeInTheDocument()
    expect(finishButton()).toBeEnabled()
    expect(createAdminTenantMock).toHaveBeenCalledTimes(1)
  })

  async function fillToModulesStep(
    user: ReturnType<typeof userEvent.setup>,
  ) {
    await fillCompanyStep(user)
    await continueWhenEnabled(user)
    await user.type(
      await screen.findByLabelText(i18n.t("admin.wizard.fields.subdomain")),
      "acme",
    )
    await continueWhenEnabled(user)
  }

  it.each([
    ["admin.modules.Rentals", "rentals"],
    ["admin.modules.PMOC", "pmoc"],
    ["admin.modules.OS", "os"],
    ["admin.modules.Catalog", "catalog"],
  ] as const)(
    "submits only %s without inventing inventory",
    async (nameKey, canonicalKey) => {
      createAdminTenantMock.mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        legalName: "Clube Acme",
        taxId: "123456789",
        subdomain: "acme",
        isActive: true,
        createdAt: "2026-09-04T00:00:00.000Z",
        activeModules: [{ moduleName: canonicalKey, isActive: true }],
        assetFamilyKeys: ["spaces"],
      })
      const user = userEvent.setup()
      renderWizard()

      await fillToModulesStep(user)
      await user.click(
        await screen.findByRole("button", {
          name: new RegExp(i18n.t(nameKey)),
        }),
      )
      await continueWhenEnabled(user)
      await user.click(await screen.findByRole("button", { name: /Espaços/ }))
      await continueWhenEnabled(user)
      await continueWhenEnabled(user)
      await user.click(finishButton())

      await waitFor(() => {
        expect(createAdminTenantMock).toHaveBeenCalled()
      })

      const payload = createAdminTenantMock.mock.calls[0]?.[0]
      expect(payload?.activeModules).toEqual([canonicalKey])
      expect(payload?.activeModules).not.toContain("inventory")
    },
  )

  it("does not select Inventory when Rentals is clicked", async () => {
    const user = userEvent.setup()
    renderWizard()

    await fillToModulesStep(user)

    const rentals = await screen.findByRole("button", {
      name: new RegExp(i18n.t("admin.modules.Rentals")),
    })
    const inventory = screen.getByRole("button", {
      name: new RegExp(i18n.t("admin.modules.Inventory")),
    })

    await user.click(rentals)

    expect(rentals).toHaveAttribute("aria-pressed", "true")
    expect(inventory).toHaveAttribute("aria-pressed", "false")
  })

  it("disables Continuar and offers retry when the module catalog fails", async () => {
    listModulesMock
      .mockRejectedValueOnce(new Error("falha do catálogo"))
      .mockResolvedValue(FIVE_COMMERCIAL_MODULES)
    const user = userEvent.setup()
    renderWizard()

    await fillToModulesStep(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "falha do catálogo",
    )
    expect(nextButton()).toBeDisabled()

    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.modules.retry") }),
    )

    expect(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    ).toBeInTheDocument()
  })

  it("never renders asset-registry as a module button even if the payload includes it", async () => {
    listModulesMock.mockResolvedValue([
      ...FIVE_COMMERCIAL_MODULES,
      commercialModule("asset-registry", {
        isCommercial: true,
        isLegacy: false,
      }),
    ])
    const user = userEvent.setup()
    renderWizard()

    await fillToModulesStep(user)

    expect(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/asset-registry/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /asset-registry/i }),
    ).not.toBeInTheDocument()
  })

  it("does not offer maintenance as a selectable module", async () => {
    listModulesMock.mockResolvedValue([
      ...FIVE_COMMERCIAL_MODULES,
      commercialModule("maintenance", {
        isCommercial: false,
        isLegacy: true,
      }),
    ])
    const user = userEvent.setup()
    renderWizard()

    await fillToModulesStep(user)

    expect(
      await screen.findByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Rentals")),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Manutenção$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Maintenance$/i }),
    ).not.toBeInTheDocument()
  })
})

