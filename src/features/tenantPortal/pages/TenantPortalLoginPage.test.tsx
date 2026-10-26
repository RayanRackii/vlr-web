import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import i18n from "@/lib/i18n"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    loginCustomer: vi.fn(),
  }
})

import { toast } from "sonner"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import {
  CustomerLoginRateLimitedError,
  clearCustomerSession,
  loginCustomer,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"

const login = vi.mocked(loginCustomer)
const toastError = vi.mocked(toast.error)

const outletContext: TenantPortalOutletContext = {
  subdomain: "ficc",
  branding: {
    subdomain: "ficc",
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#D4FF00",
    accentColor: "#FF0000",
    welcomeTagline: null,
  },
  primary: "#D4FF00",
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/t/ficc"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route path="/t/:subdomain" element={<TenantPortalLoginPage />} />
          <Route path="/t/:subdomain/app" element={<div>customer-app</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("TenantPortalLoginPage", () => {
  beforeEach(() => {
    login.mockReset()
    toastError.mockReset()
    clearCustomerSession()
  })

  afterEach(() => {
    clearCustomerSession()
  })

  it("keeps Entrar disabled until email and password pass the schema", async () => {
    const user = userEvent.setup()
    renderLogin()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.login.submit"),
    })
    const forgot = screen.getByRole("link", {
      name: i18n.t("tenantPortal.login.forgotPassword"),
    })
    const registerLink = screen.getByRole("link", {
      name: i18n.t("tenantPortal.login.registerLink"),
    })
    expect(submit).toBeDisabled()
    expect(forgot).toHaveAttribute("href", "/t/ficc/forgot-password")
    expect(registerLink).toHaveAttribute("href", "/t/ficc/register")

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "not-an-email",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "password1",
    )
    expect(submit).toBeDisabled()
    expect(login).not.toHaveBeenCalled()

    await user.clear(screen.getByLabelText(i18n.t("tenantPortal.fields.email")))
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.clear(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
    )
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "password1",
    )
    expect(submit).toBeEnabled()
  })

  it("links Esqueci a senha to the reset request screen", () => {
    renderLogin()

    expect(
      screen.getByRole("link", {
        name: i18n.t("tenantPortal.login.forgotPassword"),
      }),
    ).toHaveAttribute("href", "/t/ficc/forgot-password")
  })

  it("maps a known English API login error to Portuguese", async () => {
    const user = userEvent.setup()
    login.mockRejectedValue(new Error("E-mail ou senha inválidos."))
    renderLogin()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "wrong-password",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("E-mail ou senha inválidos.")
    })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha inválidos.",
    )
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
    ).toHaveValue("ana@club.test")
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
    ).toHaveValue("wrong-password")
    expect(
      screen.getByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    ).toBeEnabled()
    expect(screen.queryByText("customer-app")).not.toBeInTheDocument()
  })

  it("shows the rounded-up retry time after a rate-limited login", async () => {
    const user = userEvent.setup()
    login.mockRejectedValue(new CustomerLoginRateLimitedError(61))
    renderLogin()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "wrong-password",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Muitas tentativas. Tente novamente em 2 minutos.",
      )
    })
  })

  it("shows a generic message when a rate-limited login has no retry time", async () => {
    const user = userEvent.setup()
    login.mockRejectedValue(new CustomerLoginRateLimitedError(null))
    renderLogin()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "wrong-password",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Muitas tentativas. Tente novamente mais tarde.")
    })
  })

  it("opens the signed-in portal when this tenant already has a session", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana Souza")
    renderLogin()

    expect(await screen.findByText("customer-app")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    ).not.toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it("keeps the login form when the saved session belongs to another tenant", () => {
    persistCustomerSession("customer-token", "other-club", "Ana Souza")
    renderLogin()

    expect(
      screen.getByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    ).toBeInTheDocument()
    expect(screen.queryByText("customer-app")).not.toBeInTheDocument()
  })
})
