import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SetPasswordPage } from "@/features/auth/SetPasswordPage"
import { submitInvitePassword } from "@/features/auth/setPasswordService"
import i18n from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/features/auth/setPasswordService", () => ({
  submitInvitePassword: vi.fn(),
}))

import { toast } from "sonner"

const acceptInvite = vi.mocked(submitInvitePassword)
const toastError = vi.mocked(toast.error)

const accepted = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "22222222-2222-4222-8222-222222222222",
  email: "ana@club.test",
}

function renderInvite(token: string | null) {
  const path = token === null ? "/invite" : `/invite?token=${token}`
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/invite" element={<SetPasswordPage />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
        <Route path="/login" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function submitButton() {
  return screen.getByRole("button", { name: i18n.t("auth.invite.submit") })
}

describe("SetPasswordPage validity gate", () => {
  beforeEach(() => {
    acceptInvite.mockReset()
    toastError.mockReset()
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: "1" }, session: {} },
      error: null,
    } as never)
  })

  it("keeps Definir senha disabled until both passwords match the schema", async () => {
    const user = userEvent.setup()
    renderInvite("invite-token")

    expect(submitButton()).toBeDisabled()

    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.passwordLabel")),
      "short",
    )
    await user.tab()
    expect(
      await screen.findByText(i18n.t("auth.invite.validation.passwordMin")),
    ).toBeInTheDocument()
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
    expect(
      await screen.findByText(i18n.t("auth.invite.validation.mismatch")),
    ).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
    expect(acceptInvite).not.toHaveBeenCalled()

    await user.clear(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
    )
    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.confirmPasswordLabel")),
      "password1",
    )
    expect(submitButton()).toBeEnabled()
  })

  it("submits a valid invite password and leaves the button usable after a server error", async () => {
    const user = userEvent.setup()
    acceptInvite.mockRejectedValueOnce(new Error("INVALID_INVITE"))
    acceptInvite.mockResolvedValueOnce(accepted)
    renderInvite("invite-token")

    await user.type(
      screen.getByLabelText(i18n.t("auth.invite.passwordLabel")),
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

    await user.click(submitButton())
    expect(await screen.findByText("dashboard")).toBeInTheDocument()
  })

  it("keeps the invalid-link login action enabled", () => {
    renderInvite(null)
    expect(
      screen.getByRole("link", { name: i18n.t("auth.invite.goToLogin") }),
    ).toBeEnabled()
  })
})
