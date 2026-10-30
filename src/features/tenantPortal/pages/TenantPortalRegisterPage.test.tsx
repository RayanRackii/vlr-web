import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AxiosError, type InternalAxiosRequestConfig } from "axios"

import { publicApi } from "@/lib/api"
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

import { toast } from "sonner"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import {
  fetchRegistrationSchema,
  readPendingEmailVerification,
  registerCustomer,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  hasActiveStaffSession,
  resetSessionRestoreGuardForTests,
} from "@/lib/sessionRestoreGuard"
import { supabase } from "@/lib/supabase"

const fetchSchema = vi.mocked(fetchRegistrationSchema)
const register = vi.mocked(registerCustomer)
const toastError = vi.mocked(toast.error)

function storeStaffSession(): void {
  window.localStorage.setItem(
    "sb-rolvix-auth-token",
    JSON.stringify({
      access_token: "leftover-staff-token",
      refresh_token: "refresh-token",
      expires_at: 1_900_000_000,
    }),
  )
}

async function fillValidRegisterCore(user: ReturnType<typeof userEvent.setup>) {
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
}

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
    resetSessionRestoreGuardForTests()
    window.sessionStorage.clear()
    window.localStorage.removeItem("sb-rolvix-auth-token")
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
    toastError.mockReset()
    vi.mocked(supabase.auth.signOut).mockReset()
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })
  })

  it("renders the submit button and pairs name/phone in a two-column layout on md+", async () => {
    renderRegister()
    await waitForRegisterForm()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    expect(submit).toBeInTheDocument()
    expect(submit.className).toContain("h-11")

    const nameField = screen.getByLabelText(i18n.t("tenantPortal.fields.name"))
    const fieldGrid = nameField.closest(".grid")
    expect(fieldGrid?.className).toContain("md:grid-cols-2")
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
    expect(screen.getByLabelText(i18n.t("tenantPortal.fields.phone"))).toHaveValue(
      "(11) 98888-0001",
    )
    expect(screen.getByLabelText(i18n.t("tenantPortal.fields.phone"))).toHaveAttribute(
      "placeholder",
      i18n.t("tenantPortal.fields.phonePlaceholder"),
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

  it("keeps the form filled and re-enables Continuar after a server error", async () => {
    const user = userEvent.setup()
    register.mockRejectedValue(new Error("Já existe uma conta com estes dados."))
    renderRegister()
    await waitForRegisterForm()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    const loginLink = screen.getByRole("link", {
      name: i18n.t("tenantPortal.register.loginLink"),
    })
    expect(submit).toBeDisabled()
    expect(loginLink).toHaveAttribute("href", "/t/ficc")

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.name")),
      "A",
    )
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText(i18n.t("tenantPortal.fields.name")),
      "na Silva",
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

    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await user.click(submit)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Já existe uma conta com estes dados.",
      )
    })
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.name")),
    ).toHaveValue("Ana Silva")
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
    ).toHaveValue("ana@club.test")
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
    ).toHaveValue("password1")
    expect(submit).toBeEnabled()
    expect(screen.queryByText("verify-email-page")).not.toBeInTheDocument()
    expect(loginLink).toHaveAttribute("href", "/t/ficc")
  })

  it("signs out a leftover staff session before registering the customer", async () => {
    const user = userEvent.setup()
    storeStaffSession()
    renderRegister()
    await waitForRegisterForm()

    await fillValidRegisterCore(user)
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await user.click(submit)

    await waitFor(() => {
      expect(register).toHaveBeenCalled()
    })
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(hasActiveStaffSession()).toBe(false)
  })

  it("keeps the staff session when registration is rejected", async () => {
    const user = userEvent.setup()
    storeStaffSession()
    register.mockRejectedValue(new Error("Já existe uma conta com estes dados."))
    renderRegister()
    await waitForRegisterForm()

    await fillValidRegisterCore(user)
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await user.click(submit)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Já existe uma conta com estes dados.",
      )
    })
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
    expect(hasActiveStaffSession()).toBe(true)
  })

  it("completes registration flow (persist pending verification + navigate) even if staff sign-out rejects", async () => {
    const user = userEvent.setup()
    storeStaffSession()
    vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error("network"))
    renderRegister()
    await waitForRegisterForm()

    await fillValidRegisterCore(user)
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await user.click(submit)

    await waitFor(() => {
      expect(register).toHaveBeenCalled()
    })
    expect(await screen.findByText("verify-email-page")).toBeInTheDocument()
    expect(readPendingEmailVerification("ficc")).toEqual({
      email: "ana@club.test",
      verificationSendFailed: false,
    })
    expect(toastError).not.toHaveBeenCalled()
  })
})

describe("TenantPortalRegisterPage duplicate field errors", () => {
  beforeEach(async () => {
    window.sessionStorage.clear()
    fetchSchema.mockReset()
    register.mockReset()
    const actual = await vi.importActual<typeof import("@/features/tenantPortal/services/tenantPortalService")>(
      "@/features/tenantPortal/services/tenantPortalService",
    )
    register.mockImplementation(actual.registerCustomer)
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
    toastError.mockReset()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await i18n.changeLanguage("pt-BR")
  })

  function rejectRegistration(message: string) {
    vi.spyOn(publicApi, "post").mockRejectedValue(
      new AxiosError("Conflict", undefined, undefined, undefined, {
        status: 409,
        statusText: "Conflict",
        data: { error: message },
        headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
      }),
    )
  }

  it.each([
    ["pt-BR", "email", "A customer with this email already exists.", "Já existe uma conta com este e-mail."],
    ["en", "email", "A customer with this email already exists.", "An account with this email already exists."],
    ["es", "email", "A customer with this email already exists.", "Ya existe una cuenta con este correo electrónico."],
    ["pt-BR", "cpf", "A customer with this document already exists.", "Já existe uma conta com este CPF/CNPJ."],
    ["en", "cpf", "A customer with this CPF already exists.", "An account with this CPF/CNPJ already exists."],
    ["es", "cpf", "A customer with this document already exists.", "Ya existe una cuenta con este CPF/CNPJ."],
  ] as const)("announces the duplicate %s %s input from the API response", async (language, field, serverMessage, message) => {
    await i18n.changeLanguage(language)
    rejectRegistration(serverMessage)
    const user = userEvent.setup()
    renderRegister()
    await waitForRegisterForm()
    await fillValidRegisterCore(user)
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    expect(await screen.findByText(message)).toBeInTheDocument()
    const input = screen.getByLabelText(i18n.t(`tenantPortal.fields.${field}`))
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(message)
    const other = field === "email" ? "cpf" : "email"
    expect(screen.getByLabelText(i18n.t(`tenantPortal.fields.${other}`))).toHaveAttribute("aria-invalid", "false")
  })

  it("keeps a generic toast when the backend cannot name a single duplicate field", async () => {
    const user = userEvent.setup()
    rejectRegistration("A customer with the same email, document, or phone already exists.")
    renderRegister()
    await waitForRegisterForm()

    await fillValidRegisterCore(user)
    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
    await user.click(submit)

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Já existe uma conta com estes dados.",
      )
    })
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.email")),
    ).not.toHaveAccessibleDescription("Já existe uma conta com estes dados.")
    for (const field of ["email", "cpf"]) {
      expect(screen.getByLabelText(i18n.t(`tenantPortal.fields.${field}`))).toHaveAttribute("aria-invalid", "false")
    }
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

  it("shows the lock icon on the password and confirm password fields", async () => {
    renderRegister()
    await waitForRegisterForm()

    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.password")),
    ).toHaveClass("pl-9")
    expect(
      screen.getByLabelText(i18n.t("tenantPortal.fields.confirmPassword")),
    ).toHaveClass("pl-9")
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
      expect(phone).toHaveValue("+55 (45) 99999-9999")
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
    expect(await screen.findByLabelText(/Matrícula/)).toBeInTheDocument()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    autofillValidRegisterCore()
    expect(submit).toBeDisabled()

    autofillInput(screen.getByLabelText(/Matrícula/), "SOC-42")

    await waitFor(() => {
      expect(submit).toBeEnabled()
    })
  })

  it("keeps the unselected Empresa chip readable on a dark tenant surface", async () => {
    renderRegister()
    await waitForRegisterForm()

    const company = screen.getByRole("button", {
      name: i18n.t("tenantPortal.fields.company"),
    })
    expect(company.className).toContain("dark:bg-transparent")
    expect(company.className).toContain("text-foreground")
    expect(company.className).toContain("border-foreground/40")
  })

  it("explains a required photo when Continuar stays blocked", async () => {
    const user = userEvent.setup()
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
          fieldKey: "fotoDePerfil",
          label: "FOTO DO PERFIL",
          fieldType: "photo",
          isRequired: true,
          sortOrder: 1,
          options: null,
        },
      ],
    })

    renderRegister()
    await waitForRegisterForm()
    expect(
      await screen.findByText(i18n.t("tenantPortal.register.photoRequired")),
    ).toBeInTheDocument()

    const submit = screen.getByRole("button", {
      name: i18n.t("tenantPortal.register.submit"),
    })
    autofillValidRegisterCore()
    expect(submit).toBeDisabled()

    await user.click(submit.parentElement as HTMLElement)
    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(i18n.t("tenantPortal.register.photoRequired"))
  })
})
