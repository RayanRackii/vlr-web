import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CompanyProfilePage } from "@/features/company/pages/CompanyProfilePage"
import { getCompanyProfile, updateCompanyProfile } from "@/features/company/services/companyService"
import { TestPermissionProvider } from "@/features/users/permissions/PermissionContext"
import i18n from "@/lib/i18n"

const trial = vi.hoisted(() => ({ readOnly: false }))
vi.mock("@/features/users/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({ isLoading: false, isTrial: false, isTrialReadOnly: trial.readOnly, trialEndsAt: undefined, trialPurgeAt: undefined }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/company/services/companyService", () => ({ getCompanyProfile: vi.fn(), updateCompanyProfile: vi.fn() }))

const profile = {
  legalName: "Clube Ltda",
  tradeName: "Clube",
  taxId: "11222333000181",
  contactEmail: "oi@clube.com",
  contactPhone: "11912345678",
  address: { postalCode: "01310100", street: "Av. Paulista", number: "1000", complement: "", district: "Bela Vista", city: "São Paulo", state: "SP" },
  subdomain: "clube",
}

function renderPage(permissions: string[]) {
  return render(
    <MemoryRouter>
      <TestPermissionProvider permissions={permissions} activeModules={["rentals"]}><CompanyProfilePage /></TestPermissionProvider>
    </MemoryRouter>,
  )
}

describe("CompanyProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trial.readOnly = false
    vi.mocked(getCompanyProfile).mockResolvedValue(profile as never)
    vi.mocked(updateCompanyProfile).mockResolvedValue(profile as never)
  })

  it("shows the sections with masked values and the portal address", async () => {
    renderPage(["core.company.write"])
    expect(await screen.findByLabelText("Razão social")).toHaveValue("Clube Ltda")
    for (const heading of ["Identificação", "Contato", "Endereço", "Endereço do portal"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    }
    expect(screen.getByLabelText("CPF/CNPJ")).toHaveValue("11.222.333/0001-81")
    expect(screen.getByLabelText("WhatsApp/telefone")).toHaveValue("(11) 91234-5678")
    expect(screen.getByLabelText("CEP")).toHaveValue("01310-100")
    expect(screen.getByTestId("company-state-select")).toHaveTextContent("SP")
    expect(screen.getByTestId("company-subdomain")).toHaveTextContent("clube")
  })

  it("saves the edited profile with digits only", async () => {
    const user = userEvent.setup()
    renderPage(["core.company.write"])
    const name = await screen.findByLabelText("Razão social")
    await user.clear(name)
    await user.type(name, "Clube Novo Ltda")
    const save = await screen.findByRole("button", { name: "Salvar" })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)
    await waitFor(() => expect(updateCompanyProfile).toHaveBeenCalled())
    expect(vi.mocked(updateCompanyProfile).mock.calls[0]?.[0]).toMatchObject({
      legalName: "Clube Novo Ltda",
      taxId: "11222333000181",
      contactPhone: "11912345678",
      address: expect.objectContaining({ postalCode: "01310100", state: "SP" }),
    })
  })

  it("blocks saving with an invalid CNPJ and says why", async () => {
    const user = userEvent.setup()
    renderPage(["core.company.write"])
    const taxId = await screen.findByLabelText("CPF/CNPJ")
    await user.clear(taxId)
    await user.type(taxId, "11222333000182")
    expect(await screen.findByText("CPF ou CNPJ inválido.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled()
  })

  it("applies the CEP mask while typing", async () => {
    const user = userEvent.setup()
    renderPage(["core.company.write"])
    const cep = await screen.findByLabelText("CEP")
    await user.clear(cep)
    await user.type(cep, "04538133")
    expect(cep).toHaveValue("04538-133")
  })

  it("is read-only without core.company.write: disabled fields and no save bar", async () => {
    renderPage(["core.dashboard.read"])
    expect(await screen.findByLabelText("Razão social")).toBeDisabled()
    expect(screen.getByTestId("company-read-only")).toHaveTextContent(i18n.t("company.readOnly"))
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
  })

  it("is read-only while the trial is read-only", async () => {
    trial.readOnly = true
    renderPage(["core.company.write"])
    expect(await screen.findByLabelText("Razão social")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument()
  })

  it("keeps field groups stacked on mobile and wraps long values (class contract)", async () => {
    renderPage(["core.company.write"])
    const name = await screen.findByLabelText("Razão social")
    const grid = name.closest(".grid")
    expect(grid).toHaveClass("min-w-0", "sm:grid-cols-2")
    expect(grid).not.toHaveClass("grid-cols-2")
    expect(screen.getByLabelText("Rua").closest(".grid")).toHaveClass("sm:grid-cols-6")
    expect(screen.getByTestId("company-subdomain")).toHaveClass("break-all")
  })

  it("shows the load error", async () => {
    vi.mocked(getCompanyProfile).mockRejectedValueOnce(new Error("falhou"))
    renderPage(["core.company.write"])
    expect(await screen.findByText("falhou")).toBeInTheDocument()
  })
})
