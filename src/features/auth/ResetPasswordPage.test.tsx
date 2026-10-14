import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage"
import { supabase } from "@/lib/supabase"

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
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
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
