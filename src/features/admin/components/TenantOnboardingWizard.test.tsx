import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TenantOnboardingWizard } from "@/features/admin/components/TenantOnboardingWizard"
import { listAdminAssetFamilyCatalog } from "@/features/assets/services/assetFamiliesService"
import i18n from "@/lib/i18n"

vi.mock("@/features/assets/services/assetFamiliesService", () => ({
  listAdminAssetFamilyCatalog: vi.fn(),
}))

vi.mock("@/features/admin/services/adminTenantsService", () => ({
  createAdminTenant: vi.fn(),
}))

const listFamiliesMock = vi.mocked(listAdminAssetFamilyCatalog)

function renderWizard() {
  return render(
    <MemoryRouter>
      <TenantOnboardingWizard />
    </MemoryRouter>,
  )
}

describe("TenantOnboardingWizard", () => {
  beforeEach(() => {
    listFamiliesMock.mockResolvedValue([])
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

  it("shows a specific pt-BR message for an empty legal name, never Invalid input", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.wizard.actions.next") }),
    )

    expect(
      await screen.findByText(i18n.t("admin.wizard.validation.legalNameMin")),
    ).toBeInTheDocument()
    expect(screen.queryByText("Invalid input")).not.toBeInTheDocument()
  })

  it("shows a specific pt-BR message for a bad subdomain", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.type(
      screen.getByLabelText(i18n.t("admin.wizard.fields.legalName")),
      "Clube Acme",
    )
    await user.type(
      screen.getByLabelText(i18n.t("admin.wizard.fields.taxId")),
      "123456789",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.wizard.actions.next") }),
    )

    const subdomain = await screen.findByLabelText(
      i18n.t("admin.wizard.fields.subdomain"),
    )
    await user.type(subdomain, "Bad_Sub")
    await user.click(
      screen.getByRole("button", { name: i18n.t("admin.wizard.actions.next") }),
    )

    expect(
      await screen.findByText(i18n.t("admin.wizard.validation.subdomainFormat")),
    ).toBeInTheDocument()
    expect(screen.queryByText("Invalid input")).not.toBeInTheDocument()
  })
})
