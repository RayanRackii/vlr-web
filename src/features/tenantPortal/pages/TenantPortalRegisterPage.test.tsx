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
    fetchRegistrationSchema: vi.fn(),
    registerCustomer: vi.fn(),
  }
})

import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import {
  fetchRegistrationSchema,
  readPendingEmailVerification,
  registerCustomer,
} from "@/features/tenantPortal/services/tenantPortalService"

const fetchSchema = vi.mocked(fetchRegistrationSchema)
const register = vi.mocked(registerCustomer)

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

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/t/ficc/register"]}>
      <Routes>
        <Route element={<Outlet context={outletContext} />}>
          <Route
            path="/t/:subdomain/register"
            element={<TenantPortalRegisterPage />}
          />
          <Route
            path="/t/:subdomain/verify-email"
            element={<div>verify-email-page</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

async function waitForRegisterForm() {
  expect(
    await screen.findByRole("heading", {
      name: i18n.t("tenantPortal.register.title"),
    }),
  ).toBeInTheDocument()
  expect(
    await screen.findByLabelText(i18n.t("tenantPortal.fields.name")),
  ).toBeInTheDocument()
}

describe("TenantPortalRegisterPage email verification", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    fetchSchema.mockReset()
    register.mockReset()
    fetchSchema.mockResolvedValue({
      coreFields: [
        "name",
        "email",
        "password",
        "confirmPassword",
        "phone",
        "customerType",
        "document",
      ],
      fields: [],
    })
    register.mockResolvedValue({
      customerId: "11111111-1111-4111-8111-111111111111",
      requiresEmailVerification: true,
      verificationStarted: true,
    })
  })

  it("does not mention SMS in the register copy", async () => {
    const { container } = renderRegister()
    await waitForRegisterForm()

    expect(container.textContent).not.toMatch(/SMS/)
    expect(screen.getByText(i18n.t("tenantPortal.register.subtitle"))).toBeInTheDocument()
  })

  it("navigates to verify-email after a successful register", async () => {
    const user = userEvent.setup()
    renderRegister()
    await waitForRegisterForm()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.name")),
      "Ana Silva",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "password1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.confirmPassword")),
      "password1",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.phone")),
      "11988880001",
    )
    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.cpf")),
      "52998224725",
    )

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await user.click(submit)

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        "ficc",
        expect.objectContaining({
          email: "ana@club.test",
          name: "Ana Silva",
          phone: "11988880001",
        }),
      )
    })
    expect(await screen.findByText("verify-email-page")).toBeInTheDocument()
    expect(readPendingEmailVerification("ficc")).toEqual({
      email: "ana@club.test",
      verificationSendFailed: false,
    })
  })
})
