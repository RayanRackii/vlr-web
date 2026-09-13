import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
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
import { loginCustomer } from "@/features/tenantPortal/services/tenantPortalService"

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
  })

  it("shows Portuguese schema messages instead of Invalid input", async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.login.submit") }),
    )

    expect(
      await screen.findByText(i18n.t("tenantPortal.validation.emailInvalid")),
    ).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.validation.passwordRequired")),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
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
  })
})
