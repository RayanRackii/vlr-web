import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import i18n from "@/lib/i18n"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import type { CustomerAuthResponse } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    verifyCustomerEmail: vi.fn(),
    resendCustomerEmailVerification: vi.fn(),
  }
})

import { toast } from "sonner"
import { TenantPortalVerifyEmailPage } from "@/features/tenantPortal/pages/TenantPortalVerifyEmailPage"
import {
  persistPendingEmailVerification,
  resendCustomerEmailVerification,
  verifyCustomerEmail,
} from "@/features/tenantPortal/services/tenantPortalService"

const verifyEmail = vi.mocked(verifyCustomerEmail)
const resendEmail = vi.mocked(resendCustomerEmailVerification)
const toastSuccess = vi.mocked(toast.success)
const toastError = vi.mocked(toast.error)

const outletContext: TenantPortalOutletContext = {
  subdomain: "ficc",
  branding: {
    subdomain: "ficc",
    displayName: "FICC",
    logoSvg: null,
    primaryColor: "#123456",
    accentColor: null,
    welcomeTagline: null,
  },
  primary: "#123456",
}

const authResponse: CustomerAuthResponse = {
  token: "customer-token",
  customer: {
    id: "11111111-1111-4111-8111-111111111111",
    tenantId: "22222222-2222-4222-8222-222222222222",
    name: "Rachel",
    phone: "+5511999999999",
    email: "rachel@example.com",
    createdAt: "2026-09-11T12:00:00.000Z",
    phoneVerified: false,
    emailVerified: true,
    photoUrl: null,
  },
}

function renderVerify(state?: {
  email?: string
  verificationSendFailed?: boolean
}) {
  return render(
    <MemoryRouter
      initialEntries={[
        state
          ? { pathname: "/t/ficc/verify-email", state }
          : "/t/ficc/verify-email",
      ]}
    >
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route
            path="/t/:subdomain/verify-email"
            element={<TenantPortalVerifyEmailPage />}
          />
          <Route
            path="/t/:subdomain/app"
            element={<div>customer-app</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function assertNoSmsSignupCopy(container: HTMLElement) {
  const text = container.textContent ?? ""
  expect(text).not.toMatch(/SMS/)
  expect(text).not.toMatch(/celular usado no cadastro/)
  expect(text).not.toMatch(/enviamos um SMS/i)
}

describe("TenantPortalVerifyEmailPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    verifyEmail.mockReset()
    resendEmail.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    resendEmail.mockResolvedValue(undefined)
    verifyEmail.mockResolvedValue(authResponse)
  })

  afterEach(() => {
    vi.useRealTimers()
    window.sessionStorage.clear()
  })

  it("shows the masked email from location state and a 6-digit code field", () => {
    const { container } = renderVerify({ email: "rachel@example.com" })

    expect(screen.getByText(/r\*\*\*@example\.com/)).toBeInTheDocument()
    const code = screen.getByLabelText(i18n.t("tenantPortal.fields.code"))
    expect(code).toHaveAttribute("maxLength", "6")
    expect(code).toHaveAttribute("autocomplete", "one-time-code")
    expect(code).toHaveAttribute("inputMode", "numeric")
    assertNoSmsSignupCopy(container)
  })

  it("toasts an invalid code and stays on the page", async () => {
    const user = userEvent.setup()
    verifyEmail.mockRejectedValue(new Error("Invalid or expired verification code."))
    renderVerify({ email: "rachel@example.com" })

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.code")),
      "123456",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.verify.submit") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Invalid or expired verification code.",
      )
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(screen.queryByText("customer-app")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: i18n.t("tenantPortal.verify.title") }),
    ).toBeInTheDocument()
  })

  it("calls the resend API when send failed and resend is available", async () => {
    const user = userEvent.setup()
    renderVerify({
      email: "rachel@example.com",
      verificationSendFailed: true,
    })

    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.verify.resend") }),
    )

    await waitFor(() => {
      expect(resendEmail).toHaveBeenCalledWith("ficc", {
        email: "rachel@example.com",
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.verify.resendToastSuccess"),
    )
    expect(
      screen.queryByText(i18n.t("tenantPortal.verify.sendFailedTitle"), {
        exact: false,
      }),
    ).not.toBeInTheDocument()
  })

  it("navigates to the app after a successful verify", async () => {
    const user = userEvent.setup()
    renderVerify({ email: "rachel@example.com" })

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.code")),
      "654321",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.verify.submit") }),
    )

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith("ficc", {
        email: "rachel@example.com",
        code: "654321",
      })
    })
    expect(await screen.findByText("customer-app")).toBeInTheDocument()
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.verify.toastSuccess"),
    )
  })

  it("disables resend during the 45s cooldown", async () => {
    vi.useFakeTimers()
    renderVerify({ email: "rachel@example.com" })

    const resend = screen.getByRole("button", {
      name: i18n.t("tenantPortal.verify.resendIn", { seconds: 45 }),
    })
    expect(resend).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })

    const resendReady = screen.getByRole("button", {
      name: i18n.t("tenantPortal.verify.resend"),
    })
    expect(resendReady).toBeEnabled()
  })

  it("submits using the email restored from sessionStorage when location.state is missing", async () => {
    const user = userEvent.setup()
    persistPendingEmailVerification("ficc", {
      email: "rachel@example.com",
      verificationSendFailed: true,
    })
    renderVerify()

    expect(screen.getByText(/r\*\*\*@example\.com/)).toBeInTheDocument()
    expect(
      screen.queryByLabelText(i18n.t("tenantPortal.fields.email")),
    ).not.toBeInTheDocument()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.code")),
      "123456",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("tenantPortal.verify.submit") }),
    )

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith("ficc", {
        email: "rachel@example.com",
        code: "123456",
      })
    })
  })

  it("shows an email input and gates Confirm when nothing is stored", async () => {
    const user = userEvent.setup()
    renderVerify()

    const emailInput = screen.getByLabelText(i18n.t("tenantPortal.fields.email"))
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.verify.submit"),
    })
    expect(emailInput).toBeInTheDocument()
    expect(submit).toBeDisabled()
    expect(screen.queryByText(/r\*\*\*@example\.com/)).not.toBeInTheDocument()

    await user.type(emailInput, "rachel@example.com")
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.code")),
      "123456",
    )
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
  })
})
