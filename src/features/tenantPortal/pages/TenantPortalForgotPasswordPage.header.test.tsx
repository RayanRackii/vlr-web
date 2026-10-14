import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import i18n from "@/lib/i18n"
import { publicApi } from "@/lib/api"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { TenantPortalForgotPasswordPage } from "@/features/tenantPortal/pages/TenantPortalForgotPasswordPage"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    publicApi: {
      post: vi.fn(),
    },
  }
})

import { toast } from "sonner"

const post = vi.mocked(publicApi.post)
const toastSuccess = vi.mocked(toast.success)

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

describe("TenantPortal forgot password header", () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: {} })
    toastSuccess.mockReset()
  })

  it("sends X-Tenant-Subdomain for the portal Esqueci a senha flow and keeps the generic toast", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/t/ficc/forgot-password"]}>
        <Routes>
          <Route element={<Outlet context={outletContext} />}>
            <Route
              path="/t/:subdomain/forgot-password"
              element={<TenantPortalForgotPasswordPage />}
            />
            <Route
              path="/t/:subdomain/forgot-password/confirm"
              element={<div>confirm</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.click(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.passwordReset.requestSubmit"),
      }),
    )

    expect(post).toHaveBeenCalledWith(
      "/api/auth/customer/password-reset/request",
      { email: "ana@club.test" },
      { headers: { "X-Tenant-Subdomain": "ficc" } },
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      i18n.t("tenantPortal.passwordReset.requestToast"),
    )
    expect(await screen.findByText("confirm")).toBeInTheDocument()
  })
})
