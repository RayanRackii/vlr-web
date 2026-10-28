import { toast } from "sonner"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import { persistCustomerSession, getCustomerAccessToken } from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"
import { signOutStaffPortal } from "@/lib/sessionRestoreGuard"
import { resetSignOutMarkerForTests, staffAuthStorage } from "@/lib/signOutMarker"
import { supabase } from "@/lib/supabase"

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

function renderReset() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
        <Route path="/login" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function saveButton() {
  return screen.getByRole("button", { name: "Salvar senha" })
}

describe("ResetPasswordPage validity gate", () => {
  afterEach(() => {
    resetSignOutMarkerForTests()
    window.history.replaceState({}, "", "/")
  })

  beforeEach(() => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "1" } } },
      error: null,
    } as never)
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: "1" } },
      error: null,
    } as never)
  })

  it("keeps Salvar senha disabled until the new passwords match", async () => {
    const user = userEvent.setup()
    renderReset()

    expect(await screen.findByRole("button", { name: "Salvar senha" })).toBeDisabled()

    await user.type(screen.getByLabelText("Nova senha"), "short")
    await user.tab()
    expect(
      await screen.findByText("A senha deve ter pelo menos 8 caracteres."),
    ).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    await user.clear(screen.getByLabelText("Nova senha"))
    await user.type(screen.getByLabelText("Nova senha"), "password1")
    await user.type(screen.getByLabelText("Confirmar senha"), "password2")
    await user.tab()
    expect(await screen.findByText("As senhas não coincidem.")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(supabase.auth.updateUser).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText("Confirmar senha"))
    await user.type(screen.getByLabelText("Confirmar senha"), "password1")
    expect(saveButton()).toBeEnabled()
  })

  it("re-enables staff sign-in for the legacy hash recovery branch after Sair", async () => {
    await signOutStaffPortal()
    window.history.replaceState({}, "", "/reset-password#access_token=recovery&refresh_token=recovery-refresh&type=recovery")
    renderReset()

    await screen.findByRole("button", { name: "Salvar senha" })
    staffAuthStorage.setItem("sb-rolvix-auth-token", "recovery-session")
    expect(window.localStorage.getItem("sb-rolvix-auth-token")).toBe("recovery-session")
  })

  it("clears a stale customer session when the staff password reset succeeds", async () => {
    const user = userEvent.setup()
    persistCustomerSession("stale-customer-token", "ficc", "Ana")
    renderReset()

    await screen.findByRole("button", { name: "Salvar senha" })
    await user.type(screen.getByLabelText("Nova senha"), "password1")
    await user.type(screen.getByLabelText("Confirmar senha"), "password1")
    await user.click(saveButton())

    expect(toast.success).toHaveBeenCalledWith("Senha atualizada com sucesso.")
    expect(await screen.findByText("dashboard", {}, { timeout: 4500 })).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it("stays on the form after a server error and still allows a later save", async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.updateUser)
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Auth session missing" },
      } as never)
      .mockResolvedValueOnce({
        data: { user: { id: "1" } },
        error: null,
      } as never)
    renderReset()

    expect(await screen.findByRole("button", { name: "Salvar senha" })).toBeDisabled()
    await user.type(screen.getByLabelText("Nova senha"), "password1")
    await user.type(screen.getByLabelText("Confirmar senha"), "password1")
    await user.click(saveButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link inválido ou expirado. Solicite um novo reset na tela de login.",
    )
    expect(screen.getByLabelText("Nova senha")).toHaveValue("password1")
    expect(saveButton()).toBeEnabled()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()

    await user.click(saveButton())
    expect(toast.success).toHaveBeenCalledWith("Senha atualizada com sucesso.")
    expect(await screen.findByText("dashboard", {}, { timeout: 4500 })).toBeInTheDocument()
  })

  it("keeps Voltar ao login enabled when the recovery link is invalid", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)
    renderReset()

    expect(
      await screen.findByRole("link", { name: "Voltar ao login" }),
    ).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Salvar senha" }),
    ).not.toBeInTheDocument()
  })
})

describe("ResetPasswordPage locale", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("renders the reset form in English, including validation", async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage("en")
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: "1" } } },
      error: null,
    } as never)
    renderReset()

    expect(
      await screen.findByRole("heading", { name: "New password" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Set a new password to access the platform."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("New password")).toBeInTheDocument()
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save password" })).toBeDisabled()
    expect(screen.queryByRole("heading", { name: "Nova senha" })).not.toBeInTheDocument()
    expect(screen.queryByText("Salvar senha")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("New password"), "short")
    await user.tab()
    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("A senha deve ter pelo menos 8 caracteres."),
    ).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText("New password"))
    await user.type(screen.getByLabelText("New password"), "password1")
    await user.type(screen.getByLabelText("Confirm password"), "password2")
    await user.tab()
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument()
    expect(screen.queryByText("As senhas não coincidem.")).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText("Confirm password"))
    await user.tab()
    expect(await screen.findByText("Confirm the password.")).toBeInTheDocument()
    expect(screen.queryByText("Confirme a senha.")).not.toBeInTheDocument()
  })

  it("renders the invalid-link state in English", async () => {
    await i18n.changeLanguage("en")
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)
    renderReset()

    expect(
      await screen.findByRole("heading", { name: "New password" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid or expired link. Request a new reset on the sign-in screen.",
    )
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeEnabled()
    expect(
      screen.queryByText(
        "Link inválido ou expirado. Solicite um novo reset na tela de login.",
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Save password" }),
    ).not.toBeInTheDocument()
  })
})
