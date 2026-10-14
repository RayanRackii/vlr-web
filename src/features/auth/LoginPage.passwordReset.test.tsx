import { AxiosError, type InternalAxiosRequestConfig } from "axios"
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

function apiError(status: number, message: string): AxiosError {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    data: { error: message },
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
  })
}

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

  it("keeps Esqueci a senha disabled until the email is valid", async () => {
    const user = userEvent.setup()
    renderLogin("/login")

    const forgot = screen.getByRole("button", { name: "Esqueci a senha" })
    expect(forgot).toBeDisabled()
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled()

    await user.type(screen.getByLabelText("E-mail"), "not-an-email")
    expect(forgot).toBeDisabled()
    expect(post).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText("E-mail"))
    await user.type(screen.getByLabelText("E-mail"), "ana@club.test")
    expect(forgot).toBeEnabled()
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled()
    expect(screen.getByLabelText("Senha")).toHaveValue("")
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

  it("asks for the company on apex before sending X-Tenant-Subdomain", async () => {
    const user = userEvent.setup()
    renderLogin("/login")

    await user.type(screen.getByLabelText("E-mail"), "ana@club.test")
    await user.click(screen.getByRole("button", { name: "Esqueci a senha" }))

    expect(post).not.toHaveBeenCalled()
    expect(
      await screen.findByRole("heading", {
        name: i18n.t("auth.login.resetCompanyTitle"),
      }),
    ).toBeInTheDocument()

    const submit = screen.getByRole("button", {
      name: i18n.t("auth.login.resetCompanySubmit"),
    })
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText(i18n.t("auth.login.resetCompanyLabel")),
      "Bad_Sub",
    )
    expect(submit).toBeDisabled()
    expect(post).not.toHaveBeenCalled()

    await user.clear(
      screen.getByLabelText(i18n.t("auth.login.resetCompanyLabel")),
    )
    await user.type(
      screen.getByLabelText(i18n.t("auth.login.resetCompanyLabel")),
      "Ficc",
    )
    expect(submit).toBeEnabled()
    await user.click(submit)

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      { email: "ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "ficc" } },
    )
    expect(await screen.findByRole("status")).toHaveTextContent(genericMessage)
  })

  it("keeps the generic sentence when the reset responds with a non-5xx error", async () => {
    const user = userEvent.setup()
    post.mockRejectedValue(apiError(404, "tenant missing"))
    renderLogin("/login")

    await user.type(screen.getByLabelText("E-mail"), "ana@club.test")
    await user.click(screen.getByRole("button", { name: "Esqueci a senha" }))
    await user.type(
      screen.getByLabelText(i18n.t("auth.login.resetCompanyLabel")),
      "missing",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("auth.login.resetCompanySubmit"),
      }),
    )

    expect(post).toHaveBeenCalledWith(
      "/api/auth/forgot-password",
      { email: "ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "missing" } },
    )
    expect(await screen.findByRole("status")).toHaveTextContent(genericMessage)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText("tenant missing")).not.toBeInTheDocument()
  })

  it("stays on the company step when the reset request fails", async () => {
    const user = userEvent.setup()
    post.mockRejectedValue(apiError(500, "mail down"))
    renderLogin("/login")

    await user.type(screen.getByLabelText("E-mail"), "ana@club.test")
    await user.click(screen.getByRole("button", { name: "Esqueci a senha" }))
    await user.type(
      screen.getByLabelText(i18n.t("auth.login.resetCompanyLabel")),
      "ficc",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("auth.login.resetCompanySubmit"),
      }),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("mail down")
    expect(
      screen.getByRole("heading", {
        name: i18n.t("auth.login.resetCompanyTitle"),
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.t("auth.login.resetCompanyLabel")),
    ).toHaveValue("ficc")
  })

  it("returns to the login form without sending when the company step is cancelled", async () => {
    const user = userEvent.setup()
    renderLogin("/login")

    await user.type(screen.getByLabelText("E-mail"), "ana@club.test")
    await user.click(screen.getByRole("button", { name: "Esqueci a senha" }))
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("auth.login.resetCompanyBack"),
      }),
    )

    expect(post).not.toHaveBeenCalled()
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@club.test")
    expect(
      screen.queryByRole("heading", {
        name: i18n.t("auth.login.resetCompanyTitle"),
      }),
    ).not.toBeInTheDocument()
  })
})
