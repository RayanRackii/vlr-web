import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LoginPage } from "@/features/auth/LoginPage"
import { publicApi } from "@/lib/api"
import i18n from "@/lib/i18n"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    publicApi: {
      post: vi.fn(),
    },
  }
})

const post = vi.mocked(publicApi.post)
const genericMessage = i18n.t("auth.login.resetSent")

function renderLogin(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/t/:subdomain/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitForgotPassword() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("E-mail"), "ana@club.test")
  await user.click(screen.getByRole("button", { name: "Esqueci a senha" }))
}

describe("LoginPage forgot password", () => {
  const originalLocation = window.location

  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({
      data: { message: genericMessage },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("sends X-Tenant-Subdomain from a tenant host on the B2B login", async () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        hostname: "ficc.localhost",
        href: "http://ficc.localhost/login",
        pathname: "/login",
        origin: "http://ficc.localhost",
        host: "ficc.localhost",
      },
    })
    renderLogin("/login")

    await submitForgotPassword()

    expect(post).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      { email: "ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "ficc" } },
    )
    expect(await screen.findByRole("status")).toHaveTextContent(genericMessage)
  })

  it("sends X-Tenant-Subdomain from a /t/:subdomain path", async () => {
    renderLogin("/t/ficc/login")

    await submitForgotPassword()

    expect(post).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      { email: "ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "ficc" } },
    )
    expect(await screen.findByRole("status")).toHaveTextContent(genericMessage)
  })

  it("keeps the generic success message when the page has no current tenant", async () => {
    renderLogin("/login")

    await submitForgotPassword()

    expect(post).toHaveBeenCalledWith("/api/auth/forgot-password", {
      email: "ana@club.test",
    })
    expect(await screen.findByRole("status")).toHaveTextContent(genericMessage)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
