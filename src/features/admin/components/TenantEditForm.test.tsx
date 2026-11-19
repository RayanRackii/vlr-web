import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TenantEditForm } from "@/features/admin/components/TenantEditForm"
import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
import { listAdminModules } from "@/features/admin/services/adminModulesService"
import { updateAdminTenant } from "@/features/admin/services/adminTenantsService"
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
  enterTenantEnvironment: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/admin/components/RegistrationFieldsManager", () => ({
  RegistrationFieldsManager: () => <p>registration-manager</p>,
}))

vi.mock("@/features/admin/components/ModuleMenuItemsManager", () => ({
  ModuleMenuItemsManager: () => <p>menu-manager</p>,
}))

vi.mock("@/features/admin/components/TenantUsersManager", () => ({
  TenantUsersManager: () => <p>users-manager</p>,
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

const tenant: TenantAdmin = {
  id: TENANT_ID,
  legalName: "Clube Acme",
  taxId: "123456789",
  subdomain: "acme",
  primaryColor: "#4D6A92",
  isActive: true,
  createdAt: "2026-09-04T00:00:00.000Z",
  activeModules: [{ moduleName: "rentals", isActive: true }],
  assetFamilyKeys: ["spaces"],
  tradeName: "Acme Quadras",
  contactEmail: "contato@acme.com.br",
  contactPhone: "11988887777",
  address: {
    postalCode: "01310100",
    street: "Av. Paulista",
    number: "1000",
    complement: null,
    district: "Bela Vista",
    city: "Sao Paulo",
    state: "SP",
  },
  isTrial: false,
  isTrialReadOnly: false,
}

const listFamiliesMock = vi.mocked(listAdminAssetFamilyCatalog)
const listModulesMock = vi.mocked(listAdminModules)
const updateAdminTenantMock = vi.mocked(updateAdminTenant)

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>
}

function renderEdit(options?: {
  hasLegacyMaintenance?: boolean
  entry?: string
  tenant?: TenantAdmin
}) {
  return render(
    <MemoryRouter
      initialEntries={[options?.entry ?? `/admin/tenants/${TENANT_ID}/edit`]}
    >
      <TenantEditForm
        tenant={options?.tenant ?? tenant}
        hasLegacyMaintenance={options?.hasLegacyMaintenance}
      />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const saveName = () => i18n.t("fullPage.save")

describe("TenantEditForm tabs and save bar", () => {
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
    updateAdminTenantMock.mockResolvedValue(tenant)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the six tabs with the company tab selected by default", async () => {
    renderEdit()

    const tabs = await screen.findAllByRole("tab")
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      i18n.t("admin.edit.tabs.company"),
      i18n.t("admin.edit.tabs.portal"),
      i18n.t("admin.edit.tabs.modules"),
      i18n.t("admin.edit.tabs.users"),
      i18n.t("admin.edit.tabs.registration"),
      i18n.t("admin.edit.tabs.menu"),
    ])
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    expect(
      screen.getByRole("heading", { level: 1, name: "Clube Acme" }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.t("admin.edit.company.tradeName")),
    ).toHaveValue("Acme Quadras")
  })

  it("switches tabs through the ?tab= search param", async () => {
    const user = userEvent.setup()
    renderEdit()

    await user.click(
      await screen.findByRole("tab", { name: i18n.t("admin.edit.tabs.users") }),
    )

    expect(await screen.findByText("users-manager")).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/admin/tenants/${TENANT_ID}/edit?tab=usuarios`,
    )

    await user.click(
      screen.getByRole("tab", { name: i18n.t("admin.edit.tabs.menu") }),
    )
    expect(await screen.findByText("menu-manager")).toBeInTheDocument()
  })

  it("opens the tab named in the URL and falls back to the company tab", async () => {
    const first = renderEdit({
      entry: `/admin/tenants/${TENANT_ID}/edit?tab=portal`,
    })
    expect(
      await screen.findByLabelText(i18n.t("admin.wizard.fields.subdomain")),
    ).toHaveValue("acme")
    expect(
      screen.getByRole("button", { name: i18n.t("admin.edit.portal.enter") }),
    ).toBeEnabled()
    first.unmount()

    renderEdit({ entry: `/admin/tenants/${TENANT_ID}/edit?tab=nope` })
    expect(
      await screen.findByLabelText(i18n.t("admin.edit.company.tradeName")),
    ).toBeInTheDocument()
  })

  it("shows the save bar only while the form is dirty", async () => {
    const user = userEvent.setup()
    renderEdit()

    const tradeName = await screen.findByLabelText(
      i18n.t("admin.edit.company.tradeName"),
    )
    expect(
      screen.queryByRole("button", { name: saveName() }),
    ).not.toBeInTheDocument()

    await user.type(tradeName, " Norte")
    expect(
      await screen.findByRole("button", { name: saveName() }),
    ).toBeEnabled()

    await user.click(
      screen.getByRole("button", { name: i18n.t("fullPage.discard") }),
    )
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: saveName() }),
      ).not.toBeInTheDocument()
    })
    expect(tradeName).toHaveValue("Acme Quadras")
  })

  it("saves only the touched company fields and stays on the page", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout")
    const user = userEvent.setup()
    updateAdminTenantMock.mockResolvedValue({
      ...tenant,
      tradeName: "Acme Norte",
      contactEmail: "novo@acme.com.br",
      address: { ...tenant.address, city: "Campinas", state: "SP" },
    })
    renderEdit()

    const tradeName = await screen.findByLabelText(
      i18n.t("admin.edit.company.tradeName"),
    )
    await user.clear(tradeName)
    await user.type(tradeName, "Acme Norte")
    const email = screen.getByLabelText(i18n.t("admin.edit.company.contactEmail"))
    await user.clear(email)
    await user.type(email, "novo@acme.com.br")
    const city = screen.getByLabelText(i18n.t("admin.edit.company.city"))
    await user.clear(city)
    await user.type(city, "Campinas")

    await user.click(await screen.findByRole("button", { name: saveName() }))

    await waitFor(() => {
      expect(updateAdminTenantMock).toHaveBeenCalledTimes(1)
    })
    const [id, payload] = updateAdminTenantMock.mock.calls[0] ?? []
    expect(id).toBe(TENANT_ID)
    expect(payload).toMatchObject({
      legalName: "Clube Acme",
      tradeName: "Acme Norte",
      contactEmail: "novo@acme.com.br",
      address: {
        postalCode: "01310100",
        street: "Av. Paulista",
        number: "1000",
        complement: "",
        district: "Bela Vista",
        city: "Campinas",
        state: "SP",
      },
    })
    expect(payload?.contactPhone).toBeUndefined()

    // Stays on the page: the form resets to the saved values, nothing redirects.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: saveName() }),
      ).not.toBeInTheDocument()
    })
    expect(screen.getByTestId("location")).toHaveTextContent(
      `/admin/tenants/${TENANT_ID}/edit`,
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Clube Acme" }),
    ).toBeInTheDocument()
    expect(
      setTimeoutSpy.mock.calls.some(([, delay]) => delay === 5000),
    ).toBe(false)
  })

  it("does not send company fields that were not touched", async () => {
    const user = userEvent.setup()
    renderEdit({ entry: `/admin/tenants/${TENANT_ID}/edit?tab=portal` })

    const tagline = await screen.findByLabelText(
      i18n.t("admin.wizard.fields.welcomeTagline"),
    )
    await user.type(tagline, "Bem-vindo")
    await user.click(await screen.findByRole("button", { name: saveName() }))

    await waitFor(() => {
      expect(updateAdminTenantMock).toHaveBeenCalledTimes(1)
    })
    const payload = updateAdminTenantMock.mock.calls[0]?.[1]
    expect(payload?.welcomeTagline).toBe("Bem-vindo")
    expect(payload?.tradeName).toBeUndefined()
    expect(payload?.contactEmail).toBeUndefined()
    expect(payload?.contactPhone).toBeUndefined()
    expect(payload?.address).toBeUndefined()
  })

  it("blocks the save and shows the message when the contact e-mail is invalid", async () => {
    const user = userEvent.setup()
    renderEdit()

    const email = await screen.findByLabelText(
      i18n.t("admin.edit.company.contactEmail"),
    )
    await user.clear(email)
    await user.type(email, "nao-e-email")
    await user.click(await screen.findByRole("button", { name: saveName() }))

    expect(
      await screen.findByText(i18n.t("admin.edit.validation.contactEmailInvalid")),
    ).toBeInTheDocument()
    expect(updateAdminTenantMock).not.toHaveBeenCalled()
  })

  it("shows the trial state as a chip and text", async () => {
    renderEdit({ tenant: { ...tenant, isTrial: true, isTrialReadOnly: true } })

    expect(
      await screen.findByText(i18n.t("admin.edit.company.trialEnded")),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(i18n.t("admin.edit.status.trialEnded")).length,
    ).toBeGreaterThan(0)
  })
})

describe("TenantEditForm modules catalog", () => {
  const modulesEntry = `/admin/tenants/${TENANT_ID}/edit?tab=modulos`

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
    updateAdminTenantMock.mockResolvedValue(tenant)
  })

  it("does not add a selectable maintenance checkbox when the tenant already has legacy maintenance", async () => {
    renderEdit({ hasLegacyMaintenance: true, entry: modulesEntry })

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
    renderEdit({ hasLegacyMaintenance: true, entry: modulesEntry })

    await screen.findByRole("button", {
      name: new RegExp(i18n.t("admin.modules.Rentals")),
    })
    await user.click(
      screen.getByRole("button", {
        name: new RegExp(i18n.t("admin.modules.Catalog")),
      }),
    )
    await user.click(await screen.findByRole("button", { name: saveName() }))

    await waitFor(() => {
      expect(updateAdminTenantMock).toHaveBeenCalled()
    })

    const payload = updateAdminTenantMock.mock.calls[0]?.[1]
    expect(payload?.activeModules).toEqual(["rentals", "catalog"])
    expect(payload?.activeModules).not.toContain("maintenance")
    expect(payload?.activeModules).not.toContain("inventory")
  })

  it("disables Save and offers retry when the module catalog fails", async () => {
    listModulesMock.mockRejectedValue(new Error("falha do catálogo"))
    const user = userEvent.setup()
    renderEdit({ entry: modulesEntry })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "falha do catálogo",
    )

    // The form is dirty once a family is toggled; Save stays disabled without a catalog.
    await user.click(await screen.findByRole("button", { name: /Espaços/ }))
    expect(
      await screen.findByRole("button", { name: saveName() }),
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
