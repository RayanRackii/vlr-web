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
    requestCustomerPasswordReset: vi.fn(),
    confirmCustomerPasswordReset: vi.fn(),
  }
})

import { toast } from "sonner"
import { TenantPortalForgotPasswordPage } from "@/features/tenantPortal/pages/TenantPortalForgotPasswordPage"
import { TenantPortalResetPasswordPage } from "@/features/tenantPortal/pages/TenantPortalResetPasswordPage"
import {
  confirmCustomerPasswordReset,
  requestCustomerPasswordReset,
} from "@/features/tenantPortal/services/tenantPortalService"

const requestReset = vi.mocked(requestCustomerPasswordReset)
const confirmReset = vi.mocked(confirmCustomerPasswordReset)
const toastSuccess = vi.mocked(toast.success)
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

function renderResetFlow(initialPath = "/t/ficc/forgot-password") {
  return render(
    <MemoryRouter
      initialEntries={[
        initialPath === "/t/ficc/forgot-password/confirm"
          ? {
              pathname: initialPath,
              state: { email: "ana@club.test" },
            }
          : initialPath,
      ]}
    >
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route
            path="/t/:subdomain/forgot-password"
            element={<TenantPortalForgotPasswordPage />}
          />
          <Route
            path="/t/:subdomain/forgot-password/confirm"
            element={<TenantPortalResetPasswordPage />}
          />
          <Route path="/t/:subdomain" element={<div>login-page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("TenantPortal password reset", () => {
  beforeEach(() => {
    requestReset.mockReset()
    confirmReset.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    window.localStorage.clear()
  })

  it("asks for a code and continues even when the API stays generic", async () => {
    const user = userEvent.setup()
    requestReset.mockResolvedValue()
    renderResetFlow()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.passwordReset.requestSubmit"),
      }),
    )

    expect(requestReset).toHaveBeenCalledWith("ficc", { email: "ana@club.test" })
    expect(
      await screen.findByRole("heading", {
        name: i18n.t("tenantPortal.passwordReset.confirmTitle"),
      }),
    ).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.passwordReset.requestToast"),
    )
  })

  it("saves the new password, clears the old session, and returns to login", async () => {
    const user = userEvent.setup()
    confirmReset.mockResolvedValue()
    window.localStorage.setItem("rolvix.customer.token", "old-session")
    renderResetFlow("/t/ficc/forgot-password/confirm")

    await user.type(screen.getByLabelText(i18n.t("tenantPortal.fields.code")), "123456")
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.passwordReset.newPassword")),
      "new-secret",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.passwordReset.confirmPassword")),
      "new-secret",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.passwordReset.submit"),
      }),
    )

    await waitFor(() => {
      expect(confirmReset).toHaveBeenCalledWith("ficc", {
        email: "ana@club.test",
        code: "123456",
        newPassword: "new-secret",
      })
    })
    expect(window.localStorage.getItem("rolvix.customer.token")).toBeNull()
    expect(await screen.findByText("login-page")).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.passwordReset.toastSuccess"),
    )
  })

  it("shows the localized rate-limit error and stays on the request screen", async () => {
    const user = userEvent.setup()
    requestReset.mockRejectedValue(
      new Error(i18n.t("tenantPortal.passwordReset.rateLimited")),
    )
    renderResetFlow()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.passwordReset.requestSubmit"),
      }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("tenantPortal.passwordReset.rateLimited"),
      )
    })
    expect(
      screen.getByRole("heading", {
        name: i18n.t("tenantPortal.passwordReset.requestTitle"),
      }),
    ).toBeInTheDocument()
  })
})
