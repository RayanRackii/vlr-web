import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantOnboardingWizard } from "@/features/admin/components/TenantOnboardingWizard"
import { createAdminTenant } from "@/features/admin/services/adminTenantsService"
import { listAdminAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
import i18n from "@/lib/i18n"

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listAdminAssetFamilyCatalog: vi.fn(),
}))

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

const listFamiliesMock = vi.mocked(listAdminAssetFamilyCatalog)
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
    screen.getByRole("button", {
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
      screen.getByRole("button", {
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
      screen.getByRole("button", {
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
})
