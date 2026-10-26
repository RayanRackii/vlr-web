import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LoginPage } from "@/features/auth/LoginPage"
import {
  resetStaffSessionRefreshForTests,
  staffAuthEpochForTests,
} from "@/lib/api"
import i18n from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

function renderLogin(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
        <Route path="/os" element={<div>orders</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("LoginPage next redirect", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signInWithPassword).mockReset()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "1" }, session: {} },
      error: null,
    } as never)
  })

  async function submitValidCredentials() {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("E-mail"), "admin@clube.com")
    await user.type(screen.getByLabelText("Senha"), "password1")
    await user.click(screen.getByRole("button", { name: "Entrar" }))
  }

  it("returns to a safe staff next path after login", async () => {
    resetStaffSessionRefreshForTests()
    renderLogin("/login?next=/os")
    await submitValidCredentials()
    expect(await screen.findByText("orders")).toBeInTheDocument()
    expect(staffAuthEpochForTests()).toBe(1)
  })

  it("ignores an open-redirect next URL", async () => {
    renderLogin("/login?next=https://evil.example")
    await submitValidCredentials()
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
  })
})

describe("LoginPage validity gate", () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signInWithPassword).mockReset()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "1" }, session: {} },
      error: null,
    } as never)
  })

  it("keeps Entrar disabled until email and password pass the schema", async () => {
    const user = userEvent.setup()
    renderLogin("/login")

    const entrar = screen.getByRole("button", { name: "Entrar" })
    const forgot = screen.getByRole("button", { name: "Esqueci a senha" })
    expect(entrar).toBeDisabled()
    expect(forgot).toBeEnabled()
    expect(forgot).not.toHaveAttribute("aria-disabled")

    await user.type(screen.getByLabelText("E-mail"), "not-an-email")
    await user.type(screen.getByLabelText("Senha"), "password1")
    expect(entrar).toBeDisabled()
    expect(forgot).not.toHaveAttribute("aria-disabled")
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText("E-mail"))
    await user.type(screen.getByLabelText("E-mail"), "admin@clube.com")
    await user.clear(screen.getByLabelText("Senha"))
    expect(entrar).toBeDisabled()
    expect(forgot).toBeEnabled()
    expect(forgot).not.toHaveAttribute("aria-disabled")

    await user.type(screen.getByLabelText("Senha"), "password1")
    expect(entrar).toBeEnabled()
    expect(forgot).toBeEnabled()
  })

  it("stays on the form after a server error and re-enables Entrar", async () => {
    resetStaffSessionRefreshForTests()
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword)
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: "Invalid login credentials" },
      } as never)
      .mockResolvedValueOnce({
        data: { user: { id: "1" }, session: {} },
        error: null,
      } as never)
    renderLogin("/login")

    await user.type(screen.getByLabelText("E-mail"), "admin@clube.com")
    await user.type(screen.getByLabelText("Senha"), "password1")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("auth.login.invalidCredentials"),
    )
    expect(staffAuthEpochForTests()).toBe(1)
    expect(screen.getByLabelText("E-mail")).toHaveValue("admin@clube.com")
    expect(screen.getByLabelText("Senha")).toHaveValue("password1")
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Esqueci a senha" })).toBeEnabled()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Entrar" }))
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
  })

  it("shows the localized rate-limit message for staff login 429s", async () => {
    const user = userEvent.setup()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "Too many login attempts", status: 429 },
    } as never)
    renderLogin("/login")
    await user.type(screen.getByLabelText("E-mail"), "admin@rolvix.test")
    await user.type(screen.getByLabelText("Senha"), "password1")
    await user.click(screen.getByRole("button", { name: "Entrar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("auth.login.rateLimited"),
    )
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled()
  })
})

describe("LoginPage locale", () => {
  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("renders the sign-in and company steps in English", async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage("en")
    renderLogin("/login")

    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Sign in with your credentials to access the platform.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Your password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Forgot password" }),
    ).toBeEnabled()
    expect(screen.queryByRole("button", { name: "Entrar" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Esqueci a senha" }),
    ).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.tab()
    expect(await screen.findByText("Enter a valid email.")).toBeInTheDocument()
    expect(screen.queryByText("Informe um e-mail válido.")).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText("Email"))
    await user.type(screen.getByLabelText("Email"), "admin@clube.com")
    await user.click(screen.getByRole("button", { name: "Forgot password" }))

    expect(
      await screen.findByRole("heading", { name: "Which company?" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Enter the company identifier so we can send the reset link.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Company")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("acme")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send link" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled()
    expect(
      screen.queryByRole("heading", { name: "Qual é a empresa?" }),
    ).not.toBeInTheDocument()
  })
})
