import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom"

import i18n from "@/lib/i18n"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import { WEBKIT_AUTOFILL_ANIMATION } from "@/features/tenantPortal/lib/syncRegisterAutofill"

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

function autofillInput(element: HTMLElement, value: string) {
  fireEvent.input(element, { target: { value } })
}

async function autofillValidRegisterCore() {
  autofillInput(
    screen.getByLabelText(i18n.t("tenantPortal.fields.name")),
    "Ana Silva",
  )
  autofillInput(
    screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
    "ana@club.test",
  )
  autofillInput(
    screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
    "password1",
  )
  autofillInput(
    screen.getByLabelText(i18n.t("tenantPortal.fields.confirmPassword")),
    "password1",
  )
  autofillInput(
    screen.getByLabelText(i18n.t("tenantPortal.fields.phone")),
    "11988880001",
  )
  autofillInput(
    screen.getByLabelText(i18n.t("tenantPortal.fields.cpf")),
    "52998224725",
  )
}

describe("TenantPortalRegisterPage browser autofill", () => {
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

  it("uses semantic autocomplete attributes on core fields", async () => {
    renderRegister()
    await waitForRegisterForm()

    expect(screen.getByLabelText(i18n.t("tenantPortal.fields.name"))).toHaveAttribute(
      "autocomplete",
      "name",
    )
    expect(screen.getByLabelText(i18n.t("tenantPortal.fields.email"))).toHaveAttribute(
      "autocomplete",
      "email",
    )
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
    ).toHaveAttribute("autocomplete", "new-password")
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.confirmPassword")),
    ).toHaveAttribute("autocomplete", "new-password")
    expect(screen.getByLabelText(i18n.t("tenantPortal.fields.phone"))).toHaveAttribute(
      "autocomplete",
      "tel",
    )
    expect(screen.getByLabelText(i18n.t("tenantPortal.fields.cpf"))).toHaveAttribute(
      "autocomplete",
      "off",
    )
  })

  it("enables submit after autofill-equivalent input events populate valid fields", async () => {
    renderRegister()
    await waitForRegisterForm()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    expect(submit).toBeDisabled()

    autofillValidRegisterCore()

    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
  })

  it("enables submit after a valid +55 mobile autofill and submits national digits", async () => {
    const user = userEvent.setup()
    renderRegister()
    await waitForRegisterForm()

    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.name")),
      "Ana Silva",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "password1",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.confirmPassword")),
      "password1",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.phone")),
      "+55 45 99999-9999",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.cpf")),
      "52998224725",
    )

    const phone = screen.getByLabelText(i18n.t("tenantPortal.fields.phone"))
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => {
      expect(phone).toHaveValue("45999999999")
      expect(submit).toBeEnabled()
    })

    await user.click(submit)
    await waitFor(() => {
      expect(register).toHaveBeenCalledWith(
        "ficc",
        expect.objectContaining({
          phone: "45999999999",
        }),
      )
    })
  })

  it("keeps submit disabled when autofill leaves a required field invalid", async () => {
    renderRegister()
    await waitForRegisterForm()

    autofillValidRegisterCore()
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "not-an-email",
    )

    expect(
      screen.getByRole("button", {
        name: i18n.t("tenantPortal.register.submit"),
      }),
    ).toBeDisabled()
  })

  it("syncs webkit autofill animation into form state", async () => {
    renderRegister()
    await waitForRegisterForm()

    const nameInput = screen.getByLabelText(
      i18n.t("tenantPortal.fields.name"),
    ) as HTMLInputElement
    nameInput.value = "Ana Silva"
    const autofillStart = new Event("animationstart", { bubbles: true })
    Object.defineProperty(autofillStart, "animationName", {
      value: WEBKIT_AUTOFILL_ANIMATION,
    })
    nameInput.dispatchEvent(autofillStart)

    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
      "ana@club.test",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
      "password1",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.confirmPassword")),
      "password1",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.phone")),
      "11988880001",
    )
    autofillInput(
      screen.getByLabelText(i18n.t("tenantPortal.fields.cpf")),
      "52998224725",
    )

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: i18n.t("tenantPortal.register.submit"),
        }),
      ).toBeEnabled()
    })
    expect(nameInput).toHaveValue("Ana Silva")
  })

  it("enables submit when a required tenant extra field is autofilled", async () => {
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
      fields: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          fieldKey: "membershipId",
          label: "Matrícula",
          fieldType: "text",
          isRequired: true,
          sortOrder: 1,
          options: null,
        },
      ],
    })

    renderRegister()
    await waitForRegisterForm()
    expect(await screen.findByLabelText("Matrícula")).toBeInTheDocument()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    autofillValidRegisterCore()
    expect(submit).toBeDisabled()

    autofillInput(screen.getByLabelText("Matrícula"), "SOC-42")

    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
  })
})
