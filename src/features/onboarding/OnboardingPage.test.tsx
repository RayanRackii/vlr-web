import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { createTenant } from "@/features/onboarding/createTenant"

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
    expect(screen.getByRole("button", { name: "Criar conta de teste" })).toBeEnabled()
  })
})
