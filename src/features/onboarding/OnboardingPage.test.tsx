import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { createTenant } from "@/features/onboarding/createTenant"
import i18n from "@/lib/i18n"

vi.mock("@/features/onboarding/createTenant", () => ({
  createTenant: vi.fn(),
}))

const createTenantMock = vi.mocked(createTenant)

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    createTenantMock.mockReset()
  })

  it("creates a trial without a password and stays on the invite success screen", async () => {
    const user = userEvent.setup()
    const setTimeoutSpy = vi.spyOn(window, "setTimeout")
    createTenantMock.mockResolvedValue({
      tenantId: "11111111-1111-4111-8111-111111111111",
      headquartersUnitId: "22222222-2222-4222-8222-222222222222",
      adminUserId: null,
      superAdminRoleId: "33333333-3333-4333-8333-333333333333",
      supabaseAuthId: null,
      inviteId: "44444444-4444-4444-8444-444444444444",
      subdomain: "club",
    })

    renderOnboarding()

    await user.type(screen.getByLabelText("Razão social"), "Clube Quadras")
    await user.type(screen.getByLabelText("CNPJ/CPF"), "12345678000199")
    await user.click(screen.getByRole("button", { name: "Próximo" }))

    expect(screen.queryByLabelText("Senha")).not.toBeInTheDocument()
    expect(document.querySelector('input[type="password"]')).toBeNull()
    expect(
      screen.getByText(
        "A senha não é pedida aqui. Depois de criar a conta, enviamos um convite para este e-mail.",
      ),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Nome do administrador"), "Ana Costa")
    await user.type(
      screen.getByLabelText("E-mail do administrador"),
      "ana@clube.com",
    )
    await user.type(screen.getByLabelText("Celular (com DDD)"), "11999999999")
    await user.click(screen.getByRole("button", { name: "Próximo" }))
    await user.click(screen.getByRole("button", { name: "Criar conta de teste" }))

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(
      "Enviamos um convite para ana@clube.com. Abra esse e-mail e defina a senha no link do convite.",
    )
    expect(screen.queryByText("login-page")).not.toBeInTheDocument()
    expect(screen.queryByText(/redirecionado para o login/i)).not.toBeInTheDocument()
    expect(
      setTimeoutSpy.mock.calls.some((call) => call[1] === 3000),
    ).toBe(false)

    expect(createTenantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmail: "ana@clube.com",
        isTrial: true,
      }),
    )
    expect(createTenantMock.mock.calls[0]?.[0]).not.toHaveProperty("adminPassword")

    setTimeoutSpy.mockRestore()
  })

  it("shows the friendly signup error and keeps the form", async () => {
    const user = userEvent.setup()
    createTenantMock.mockRejectedValue(
      new Error("Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente."),
    )

    renderOnboarding()

    await user.type(screen.getByLabelText("Razão social"), "Clube Quadras")
    await user.type(screen.getByLabelText("CNPJ/CPF"), "12345678000199")
    await user.click(screen.getByRole("button", { name: "Próximo" }))
    await user.type(screen.getByLabelText("Nome do administrador"), "Ana Costa")
    await user.type(
      screen.getByLabelText("E-mail do administrador"),
      "ana@clube.com",
    )
    await user.type(screen.getByLabelText("Celular (com DDD)"), "11999999999")
    await user.click(screen.getByRole("button", { name: "Próximo" }))
    await user.click(screen.getByRole("button", { name: "Criar conta de teste" }))

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
    )
    expect(screen.queryByText("ANONYMOUS_TRIAL_RATE_LIMITED")).not.toBeInTheDocument()
    expect(screen.getByText("Clube Quadras")).toBeInTheDocument()
    expect(screen.getByText("ana@clube.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Criar conta de teste" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled()

    createTenantMock.mockResolvedValueOnce({
      tenantId: "11111111-1111-4111-8111-111111111111",
      headquartersUnitId: "22222222-2222-4222-8222-222222222222",
      adminUserId: null,
      superAdminRoleId: "33333333-3333-4333-8333-333333333333",
      supabaseAuthId: null,
      inviteId: "44444444-4444-4444-8444-444444444444",
      subdomain: "club",
    })
    await user.click(screen.getByRole("button", { name: "Criar conta de teste" }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Enviamos um convite para ana@clube.com. Abra esse e-mail e defina a senha no link do convite.",
    )
    expect(createTenantMock).toHaveBeenCalledTimes(2)
  })
})

describe("OnboardingPage validity gate", () => {
  beforeEach(() => {
    createTenantMock.mockReset()
  })

  it("keeps Próximo disabled until the current step schema is valid", async () => {
    const user = userEvent.setup()
    renderOnboarding()

    const next = screen.getByRole("button", { name: "Próximo" })
    expect(next).toBeDisabled()
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled()

    await user.type(screen.getByLabelText("Razão social"), "   ")
    await user.type(screen.getByLabelText("CNPJ/CPF"), "12345678000199")
    expect(next).toBeDisabled()
    expect(createTenantMock).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText("Razão social"))
    await user.type(screen.getByLabelText("Razão social"), "Clube Quadras")
    expect(next).toBeEnabled()

    await user.clear(screen.getByLabelText("Razão social"))
    expect(next).toBeDisabled()

    await user.type(screen.getByLabelText("Razão social"), "Clube Quadras")
    await user.click(next)

    expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled()

    await user.type(screen.getByLabelText("Nome do administrador"), "Ana Costa")
    await user.type(screen.getByLabelText("E-mail do administrador"), "not-an-email")
    await user.type(screen.getByLabelText("Celular (com DDD)"), "119999999")
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled()

    await user.clear(screen.getByLabelText("E-mail do administrador"))
    await user.type(screen.getByLabelText("E-mail do administrador"), "ana@clube.com")
    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled()

    await user.clear(screen.getByLabelText("Celular (com DDD)"))
    await user.type(screen.getByLabelText("Celular (com DDD)"), "11999999999")
    expect(screen.getByRole("button", { name: "Próximo" })).toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Próximo" }))
    expect(screen.getByRole("button", { name: "Criar conta de teste" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled()
    expect(createTenantMock).not.toHaveBeenCalled()
  })
})

describe("OnboardingPage locale", () => {
  beforeEach(() => {
    createTenantMock.mockReset()
  })

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("renders the public trial form in English", async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage("en")
    renderOnboarding()

    expect(
      screen.getByRole("heading", { name: "Start your free trial" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "14 days full access, then read-only until day 30. No WhatsApp; up to 10 assets and 20 users.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("navigation", { name: "Progress" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled()
    expect(
      screen.queryByRole("heading", { name: "Comece seu teste grátis" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Próximo" }),
    ).not.toBeInTheDocument()

    const legalName = screen.getByLabelText("Legal name")
    await user.click(legalName)
    await user.tab()
    expect(
      await screen.findByText("Legal name is required."),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Razão social é obrigatória."),
    ).not.toBeInTheDocument()

    await user.type(legalName, "Club Courts")
    await user.type(screen.getByLabelText("Tax ID"), "12345678000199")
    expect(screen.getByLabelText("Headquarters unit name")).toHaveValue(
      "Matriz",
    )
    await user.click(screen.getByRole("button", { name: "Next" }))

    expect(screen.getByLabelText("Admin full name")).toBeInTheDocument()
    expect(screen.getByLabelText("Admin email")).toBeInTheDocument()
    expect(screen.getByLabelText("Mobile phone")).toHaveAttribute(
      "placeholder",
      "11999999999",
    )
    expect(
      screen.getByText(
        "A password is not collected here. After you create the account, we email an invite to this address.",
      ),
    ).toBeInTheDocument()
  })
})
