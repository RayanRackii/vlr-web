import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginPage } from "@/features/auth/LoginPage"
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
    renderLogin("/login?next=/os")
    await submitValidCredentials()
    expect(await screen.findByText("orders")).toBeInTheDocument()
  })

  it("ignores an open-redirect next URL", async () => {
    renderLogin("/login?next=https://evil.example")
    await submitValidCredentials()
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
  })
})
