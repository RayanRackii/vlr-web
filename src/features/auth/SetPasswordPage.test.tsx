import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SetPasswordPage } from "@/features/auth/SetPasswordPage"
import {
  EXISTING_ACCOUNT_SIGN_IN_REQUIRED,
  INVITE_ACCOUNT_MISMATCH,
  INVITE_ALREADY_ACCEPTED,
  INVITE_IDENTITY_CONFLICT,
  InviteAcceptError,
  acceptExistingAccountInvite,
  acceptNewAccountInvite,
  previewInvite,
} from "@/features/auth/inviteAcceptService"
import {
  PLATFORM_ADMIN_USES_ENTER,
  StaffTenantError,
  listMyStaffTenants,
  selectMyStaffTenant,
} from "@/features/users/services/staffTenantsService"
import {
  resetStaffSessionRefreshForTests,
  staffAuthEpochForTests,
} from "@/lib/api"
import { persistCustomerSession, getCustomerAccessToken } from "@/features/tenantPortal/services/tenantPortalService"
import i18n from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/auth/inviteAcceptService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/auth/inviteAcceptService")>()
  return {
    ...actual,
    previewInvite: vi.fn(),
    acceptNewAccountInvite: vi.fn(),
    acceptExistingAccountInvite: vi.fn(),
  }
})

vi.mock("@/features/users/services/staffTenantsService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/users/services/staffTenantsService")
    >()
  return {
    ...actual,
    listMyStaffTenants: vi.fn(),
    selectMyStaffTenant: vi.fn(),
  }
})

import { toast } from "sonner"

const preview = vi.mocked(previewInvite)
const acceptNew = vi.mocked(acceptNewAccountInvite)
const acceptExisting = vi.mocked(acceptExistingAccountInvite)
const listTenants = vi.mocked(listMyStaffTenants)
const selectTenant = vi.mocked(selectMyStaffTenant)
const toastError = vi.mocked(toast.error)
const toastSuccess = vi.mocked(toast.success)
const signIn = vi.mocked(supabase.auth.signInWithPassword)
const refreshSession = vi.mocked(supabase.auth.refreshSession)

const tenantId = "22222222-2222-4222-8222-222222222222"
const otherTenantId = "33333333-3333-4333-8333-333333333333"
const userId = "11111111-1111-4111-8111-111111111111"

const newPreview = {
  email: "ana@club.test",
  fullName: "Ana",
  tenantId,
  tenantName: "Clube Norte",
  existingAccount: false,
  expiresAt: "2026-10-20T12:00:00+00:00",
}

const existingPreview = {
  ...newPreview,
  existingAccount: true,
  email: "bia@club.test",
  tenantName: "Clube Sul",
  tenantId: otherTenantId,
}

const acceptedNew = {
  userId,
  tenantId,
  email: newPreview.email,
  existingAccount: false,
}

function membership(
  id: string,
  legalName: string,
  tradeName: string | null,
) {
  return {
    tenantId: id,
    legalName,
    tradeName,
    subdomain: null,
  }
}

function tenantList(
  memberships: ReturnType<typeof membership>[],
  accessTokenTenantId: string | null,
) {
  return {
    accessTokenTenantId,
    authMetadataTenantId: accessTokenTenantId,
    sessionRefreshRequired: false,
    memberships,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderInvite(token: string | null) {
  const path = token === null ? "/invite" : `/invite?token=${token}`
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/invite"
          element={
            <>
              <SetPasswordPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="/dashboard" element={<div>dashboard</div>} />
        <Route path="/login" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function submitButton() {
  return screen.getByRole("button", { name: i18n.t("auth.invite.submit") })
}

async function fillNewPassword(password = "password1", confirm = password) {
  const user = userEvent.setup()
  await user.type(
    await screen.findByLabelText(i18n.t("auth.invite.passwordLabel")),
    password,
  )
  await user.type(
    screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
    confirm,
  )
  return user
}

describe("SetPasswordPage", () => {
  beforeEach(() => {
    resetStaffSessionRefreshForTests()
    window.sessionStorage.clear()
    preview.mockReset()
    acceptNew.mockReset()
    acceptExisting.mockReset()
    listTenants.mockReset()
    selectTenant.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
    signIn.mockReset()
    refreshSession.mockReset()
    preview.mockResolvedValue(newPreview)
    acceptNew.mockResolvedValue(acceptedNew)
    acceptExisting.mockResolvedValue({ ...acceptedNew, existingAccount: true })
    listTenants.mockResolvedValue(
      tenantList(
        [membership(tenantId, "Clube Norte Ltda", "Clube Norte")],
        tenantId,
      ),
    )
    selectTenant.mockResolvedValue({
      tenantId,
      legalName: "Clube Norte Ltda",
      tradeName: "Clube Norte",
      subdomain: null,
      sessionRefreshRequired: true,
    })
    signIn.mockResolvedValue({
      data: { user: { id: userId }, session: {} },
      error: null,
    } as never)
    refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as never)
  })

  it("keeps Definir senha disabled until both passwords match the schema", async () => {
    const user = userEvent.setup()
    renderInvite("invite-token")

    expect(await screen.findByRole("button", { name: i18n.t("auth.invite.submit") })).toBeDisabled()
    expect(preview).toHaveBeenCalledWith("invite-token")

    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.passwordLabel")),
      "short",
    )
    await user.tab()
    const passwordError = await screen.findByText(i18n.t("auth.invite.validation.passwordMin"))
    const passwordField = screen.getByLabelText(i18n.t("auth.invite.passwordLabel"))
    expect(passwordError).toBeInTheDocument()
    expect(passwordField).toHaveAttribute("aria-invalid", "true")
    expect(passwordField.getAttribute("aria-describedby")?.split(" ")).toContain(passwordError.id)
    expect(passwordField).toHaveAccessibleDescription(
      `${i18n.t("auth.invite.passwordHint")} ${i18n.t("auth.invite.validation.passwordMin")}`,
    )
    expect(submitButton()).toBeDisabled()

    await user.clear(screen.getByLabelText(i18n.t("auth.invite.passwordLabel")))
    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.passwordLabel")),
      "password1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
      "password2",
    )
    await user.tab()
    const confirmError = await screen.findByText(i18n.t("auth.invite.validation.mismatch"))
    const confirmField = screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel"))
    expect(confirmField).toHaveAttribute("aria-invalid", "true")
    expect(confirmField.getAttribute("aria-describedby")?.split(" ")).toContain(confirmError.id)
    expect(submitButton()).toBeDisabled()
    expect(acceptNew).not.toHaveBeenCalled()

    await user.clear(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
    )
    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
      "password1",
    )
    expect(submitButton()).toBeEnabled()
  })

  it("submits a new-account password and leaves the button usable after a server error", async () => {
    const user = userEvent.setup()
    acceptNew.mockRejectedValueOnce(new Error("INVALID_INVITE"))
    acceptNew.mockResolvedValueOnce(acceptedNew)
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.passwordLabel")),
      "password1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
      "password1",
    )
    await user.click(submitButton())

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(i18n.t("auth.invite.toastError"))
    })
    expect(screen.getByText(i18n.t("auth.invite.title"))).toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.t("auth.invite.passwordLabel")),
    ).toHaveValue("password1")
    expect(submitButton()).toBeEnabled()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    expect(staffAuthEpochForTests()).toBe(0)
    expect(signIn).not.toHaveBeenCalled()

    await user.click(submitButton())
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(acceptNew).toHaveBeenLastCalledWith({
      token: "invite-token",
      password: "password1",
    })
    expect(acceptExisting).not.toHaveBeenCalled()
    expect(selectTenant).not.toHaveBeenCalled()
    expect(refreshSession).not.toHaveBeenCalled()
    expect(staffAuthEpochForTests()).toBe(1)
    const acceptOrder = acceptNew.mock.invocationCallOrder.at(-1) ?? 0
    const signInOrder = signIn.mock.invocationCallOrder[0] ?? 0
    expect(acceptOrder).toBeLessThan(signInOrder)
  })

  it("clears a stale customer session when a new-account invite signs staff in", async () => {
    const user = userEvent.setup()
    persistCustomerSession("stale-customer-token", "ficc", "Ana")
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.passwordLabel")),
      "password1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
      "password1",
    )
    await user.click(submitButton())

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it("clears a stale customer session when an existing account signs in to accept", async () => {
    preview.mockResolvedValue(existingPreview)
    persistCustomerSession("stale-customer-token", "ficc", "Ana")
    const user = userEvent.setup()
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(getCustomerAccessToken()).toBeNull()
  })

  it("asks an existing account to sign in and accepts with the session, never a new password", async () => {
    preview.mockResolvedValue(existingPreview)
    const user = userEvent.setup()
    renderInvite("invite-token")

    expect(
      await screen.findByRole("button", {
        name: i18n.t("auth.invite.signInSubmit"),
      }),
    ).toBeDisabled()
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.passwordLabel")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        i18n.t("auth.invite.welcomeExisting", {
          email: existingPreview.email,
          tenant: existingPreview.tenantName,
        }),
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(i18n.t("auth.login.emailLabel"))).toHaveValue(
      existingPreview.email,
    )
    expect(screen.getByLabelText(i18n.t("auth.login.emailLabel"))).toHaveAttribute(
      "readonly",
    )

    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(signIn).toHaveBeenCalledWith({
      email: existingPreview.email,
      password: "current-secret",
    })
    expect(acceptExisting).toHaveBeenCalledWith({ token: "invite-token" })
    expect(acceptNew).not.toHaveBeenCalled()
    expect(selectTenant).not.toHaveBeenCalled()
    const signInOrder = signIn.mock.invocationCallOrder[0] ?? 0
    const acceptOrder = acceptExisting.mock.invocationCallOrder[0] ?? 0
    expect(signInOrder).toBeLessThan(acceptOrder)
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("auth.invite.toastJoined", { tenant: existingPreview.tenantName }),
    )
  })

  it("does not accept when the existing password is rejected", async () => {
    preview.mockResolvedValue(existingPreview)
    signIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    } as never)
    const user = userEvent.setup()
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "wrong-password",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(i18n.t("auth.login.invalidCredentials"))
    expect(acceptExisting).not.toHaveBeenCalled()
    expect(acceptNew).not.toHaveBeenCalled()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
    ).toHaveValue("wrong-password")
    const passwordField = screen.getByLabelText(i18n.t("auth.invite.existingPasswordLabel"))
    const error = screen.getByRole("alert")
    expect(passwordField.getAttribute("aria-describedby")?.split(" ")).toContain(error.id)
    expect(passwordField).toHaveAttribute("aria-invalid", "true")
    expect(passwordField).toHaveAccessibleDescription(i18n.t("auth.login.invalidCredentials"))
  })

  it("switches a 409 existing-account response to sign-in and does not send the new password again", async () => {
    acceptNew.mockRejectedValueOnce(
      new InviteAcceptError(EXISTING_ACCOUNT_SIGN_IN_REQUIRED, 409),
    )
    renderInvite("invite-token")
    const user = await fillNewPassword()
    await user.click(submitButton())

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("auth.invite.errors.existingAccount"),
      )
    })
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.passwordLabel")),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    ).toBeDisabled()

    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(acceptNew).toHaveBeenCalledTimes(1)
    expect(acceptExisting).toHaveBeenCalledWith({ token: "invite-token" })
    expect(acceptExisting.mock.calls[0]?.[0]).not.toHaveProperty("password")
  })

  it("shows the 403 mismatch message and stays on sign-in", async () => {
    preview.mockResolvedValue(existingPreview)
    acceptExisting.mockRejectedValueOnce(
      new InviteAcceptError(INVITE_ACCOUNT_MISMATCH, 403),
    )
    const user = userEvent.setup()
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("auth.invite.errors.accountMismatch"),
      )
    })
    expect(
      screen.getByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
    ).toHaveValue("current-secret")
    expect(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    ).toBeEnabled()
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.passwordLabel")),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
  })

  it("shows the identity-conflict message and does not change the sign-in form", async () => {
    preview.mockResolvedValue(existingPreview)
    acceptExisting.mockRejectedValueOnce(
      new InviteAcceptError(INVITE_IDENTITY_CONFLICT, 409),
    )
    const user = userEvent.setup()
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        i18n.t("auth.invite.errors.identityConflict"),
      )
    })
    expect(
      screen.getByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
    ).toHaveValue("current-secret")
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
  })

  it("offers a tenant picker when the account has more than one membership and refreshes the session", async () => {
    preview.mockResolvedValue(existingPreview)
    listTenants.mockResolvedValue(
      tenantList(
        [
          membership(tenantId, "Clube Norte Ltda", "Clube Norte"),
          membership(otherTenantId, "Clube Sul Ltda", "Clube Sul"),
        ],
        tenantId,
      ),
    )
    const user = userEvent.setup()
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )

    expect(
      await screen.findByRole("radio", { name: /Clube Sul/ }),
    ).toBeChecked()
    expect(screen.getByRole("radio", { name: /Clube Norte/ })).not.toBeChecked()
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    expect(refreshSession).not.toHaveBeenCalled()

    await user.click(screen.getByRole("radio", { name: /Clube Norte/ }))
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.pickerSubmit") }),
    )

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(selectTenant).toHaveBeenCalledWith(tenantId)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it("stays on the picker when the session refresh fails", async () => {
    preview.mockResolvedValue(existingPreview)
    listTenants.mockResolvedValue(
      tenantList(
        [
          membership(tenantId, "Clube Norte Ltda", "Clube Norte"),
          membership(otherTenantId, "Clube Sul Ltda", null),
        ],
        tenantId,
      ),
    )
    refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "refresh failed" },
    } as never)
    const user = userEvent.setup()
    renderInvite("invite-token")

    await user.type(
      await screen.findByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
      "current-secret",
    )
    await user.click(
      screen.getByRole("button", { name: i18n.t("auth.invite.signInSubmit") }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: i18n.t("auth.invite.pickerSubmit"),
      }),
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(i18n.t("auth.invite.pickerError"))
    })
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("auth.invite.pickerSubmit") }),
    ).toBeEnabled()
  })

  it("selects the only membership when the access token still names another tenant", async () => {
    listTenants.mockResolvedValue(
      tenantList(
        [membership(tenantId, "Clube Norte Ltda", "Clube Norte")],
        otherTenantId,
      ),
    )
    renderInvite("invite-token")
    const user = await fillNewPassword()
    await user.click(submitButton())

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(selectTenant).toHaveBeenCalledWith(tenantId)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole("button", { name: i18n.t("auth.invite.pickerSubmit") }),
    ).not.toBeInTheDocument()
  })

  it("opens the dashboard for a platform admin without a membership picker", async () => {
    listTenants.mockRejectedValue(
      new StaffTenantError(PLATFORM_ADMIN_USES_ENTER, 409),
    )
    renderInvite("invite-token")
    const user = await fillNewPassword()
    await user.click(submitButton())

    expect(await screen.findByText("dashboard")).toBeInTheDocument()
    expect(selectTenant).not.toHaveBeenCalled()
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it("keeps the invalid-link login action enabled", async () => {
    renderInvite(null)
    expect(
      await screen.findByRole("link", { name: i18n.t("auth.invite.goToLogin") }),
    ).toBeEnabled()
    expect(preview).not.toHaveBeenCalled()
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.passwordLabel")),
    ).not.toBeInTheDocument()
  })

  it("treats a failed preview as an invalid link", async () => {
    preview.mockRejectedValue(new InviteAcceptError("INVALID_INVITE", 404))
    renderInvite("invite-token")
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent(i18n.t("auth.invite.checking"))

    expect(
      await screen.findByRole("link", { name: i18n.t("auth.invite.goToLogin") }),
    ).toBeEnabled()
    expect(screen.getByText(i18n.t("auth.invite.invalidLink"))).toBe(status)
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.passwordLabel")),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(i18n.t("auth.invite.existingPasswordLabel")),
    ).not.toBeInTheDocument()
  })

  describe("already-accepted invite", () => {
    const getSession = vi.mocked(supabase.auth.getSession)

    it("resumes the tenant picker when signed in", async () => {
      preview.mockRejectedValue(new InviteAcceptError(INVITE_ALREADY_ACCEPTED, 409))
      getSession.mockResolvedValueOnce({
        data: { session: { access_token: "t" } },
        error: null,
      } as never)
      listTenants.mockResolvedValue(
        tenantList(
          [
            membership(tenantId, "Clube Norte Ltda", "Clube Norte"),
            membership(otherTenantId, "Clube Sul Ltda", "Clube Sul"),
          ],
          tenantId,
        ),
      )
      renderInvite("used-token")

      expect((await screen.findAllByText(i18n.t("auth.invite.pickerTitle"))).length).toBeGreaterThan(0)
      expect(screen.queryByText(i18n.t("auth.invite.invalidLink"))).not.toBeInTheDocument()
      expect(screen.getByRole("radio", { name: /Clube Sul/ })).toBeInTheDocument()
    })

    it("asks to log in when signed out", async () => {
      preview.mockRejectedValue(new InviteAcceptError(INVITE_ALREADY_ACCEPTED, 409))
      renderInvite("used-token")

      expect(await screen.findByText(i18n.t("auth.invite.alreadyAccepted"))).toBeInTheDocument()
      expect(screen.queryByText(i18n.t("auth.invite.invalidLink"))).not.toBeInTheDocument()
      expect(screen.getByRole("link", { name: i18n.t("auth.invite.goToLogin") })).toHaveAttribute("href", "/login")
      expect(listTenants).not.toHaveBeenCalled()
    })

    it("still shows invalid link for other preview errors", async () => {
      preview.mockRejectedValue(new InviteAcceptError("Invite was revoked.", 409))
      renderInvite("revoked-token")

      expect(await screen.findByText(i18n.t("auth.invite.invalidLink"))).toBeInTheDocument()
    })
  })

  it("drops the token from the URL after a successful accept without re-previewing", async () => {
    listTenants.mockResolvedValue(
      tenantList(
        [
          membership(tenantId, "Clube Norte Ltda", "Clube Norte"),
          membership(otherTenantId, "Clube Sul Ltda", "Clube Sul"),
        ],
        otherTenantId,
      ),
    )
    renderInvite("invite-token")
    const user = await fillNewPassword()
    await user.click(submitButton())

    expect((await screen.findAllByText(i18n.t("auth.invite.pickerTitle"))).length).toBeGreaterThan(0)
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/invite$/)
    expect(preview).toHaveBeenCalledTimes(1)
  })

  describe("token kept out of the address bar", () => {
    const getSession = vi.mocked(supabase.auth.getSession)
    const twoTenants = () =>
      tenantList(
        [
          membership(tenantId, "Clube Norte Ltda", "Clube Norte"),
          membership(otherTenantId, "Clube Sul Ltda", "Clube Sul"),
        ],
        tenantId,
      )

    it("strips ?token= on load and still accepts with the in-memory token", async () => {
      renderInvite("invite-token")

      await waitFor(() => {
        expect(screen.getByTestId("location")).toHaveTextContent(/^\/invite$/)
      })
      const user = await fillNewPassword()
      await user.click(submitButton())

      await waitFor(() => {
        expect(acceptNew).toHaveBeenCalledWith({ token: "invite-token", password: "password1" })
      })
      expect(preview).toHaveBeenCalledTimes(1)
    })

    it("strips ?token= in the signed-out already-accepted state", async () => {
      preview.mockRejectedValue(new InviteAcceptError(INVITE_ALREADY_ACCEPTED, 409))
      renderInvite("used-token")

      expect(await screen.findByText(i18n.t("auth.invite.alreadyAccepted"))).toBeInTheDocument()
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/invite$/)
    })

    it("strips ?token= in the signed-in already-accepted picker", async () => {
      preview.mockRejectedValue(new InviteAcceptError(INVITE_ALREADY_ACCEPTED, 409))
      getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } }, error: null } as never)
      listTenants.mockResolvedValue(twoTenants())
      renderInvite("used-token")

      expect((await screen.findAllByText(i18n.t("auth.invite.pickerTitle"))).length).toBeGreaterThan(0)
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/invite$/)
    })

    it("after F5 without ?token= re-previews the tab's stored token (already accepted)", async () => {
      window.sessionStorage.setItem("rolvix.invite.token", "used-token")
      preview.mockRejectedValue(new InviteAcceptError(INVITE_ALREADY_ACCEPTED, 409))
      renderInvite(null)

      expect(await screen.findByText(i18n.t("auth.invite.alreadyAccepted"))).toBeInTheDocument()
      expect(preview).toHaveBeenCalledWith("used-token")
    })

    it("without any token goes to the picker when signed in", async () => {
      getSession.mockResolvedValueOnce({ data: { session: { access_token: "t" } }, error: null } as never)
      listTenants.mockResolvedValue(twoTenants())
      renderInvite(null)

      expect((await screen.findAllByText(i18n.t("auth.invite.pickerTitle"))).length).toBeGreaterThan(0)
      expect(preview).not.toHaveBeenCalled()
    })

    it("without any token shows invalid link when signed out", async () => {
      renderInvite(null)

      expect(await screen.findByText(i18n.t("auth.invite.invalidLink"))).toBeInTheDocument()
      expect(screen.getByRole("link", { name: i18n.t("auth.invite.goToLogin") })).toHaveAttribute("href", "/login")
    })

    it("forgets a stored token that turned out invalid", async () => {
      preview.mockRejectedValue(new InviteAcceptError("Invite was revoked.", 409))
      renderInvite("revoked-token")

      expect(await screen.findByText(i18n.t("auth.invite.invalidLink"))).toBeInTheDocument()
      expect(window.sessionStorage.getItem("rolvix.invite.token")).toBeNull()
    })
  })
})
