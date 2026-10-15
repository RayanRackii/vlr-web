import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { ThemeProvider } from "@/components/ThemeProvider"
import i18n from "@/lib/i18n"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { TenantPortalForgotPasswordPage } from "@/features/tenantPortal/pages/TenantPortalForgotPasswordPage"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchTenantBranding: vi.fn(async () => ({
      subdomain: "ficc",
      displayName: "FICC",
      logoSvg: null,
      primaryColor: "#D4FF00",
      accentColor: "#FF0000",
      welcomeTagline: null,
    })),
    fetchRegistrationSchema: vi.fn(async () => ({
      coreFields: [],
      fields: [],
    })),
  }
})

function renderPortal(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/t/:subdomain" element={<TenantPortalLayout />}>
            <Route index element={<TenantPortalLoginPage />} />
            <Route path="register" element={<TenantPortalRegisterPage />} />
            <Route
              path="forgot-password"
              element={<TenantPortalForgotPasswordPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

async function chooseLanguage(nativeName: string) {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole("button", { name: i18n.t("language.label") }),
  )
  await user.click(
    await screen.findByRole("menuitem", { name: new RegExp(nativeName) }),
  )
}

describe("logged-out portal language switch", () => {
  beforeEach(async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
    window.localStorage.removeItem("i18nextLng")
    await i18n.changeLanguage("pt-BR")
  })

  afterEach(async () => {
    window.localStorage.removeItem("i18nextLng")
    await i18n.changeLanguage("pt-BR")
  })

  it("switches login copy immediately and keeps the choice", async () => {
    const first = renderPortal("/t/ficc")
    expect(
      await screen.findByRole("heading", { name: "Entrar" }),
    ).toBeInTheDocument()

    await chooseLanguage("English")

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem("i18nextLng")).toBe("en")
    expect(document.documentElement.lang).toBe("en")
    first.unmount()

    renderPortal("/t/ficc")
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Entrar" }),
    ).not.toBeInTheDocument()
  })

  it("switches signup copy and shows each language in its own name", async () => {
    renderPortal("/t/ficc/register")
    expect(
      await screen.findByRole("heading", { name: "Criar conta" }),
    ).toBeInTheDocument()

    await chooseLanguage("English")
    expect(
      await screen.findByRole("heading", { name: "Create account" }),
    ).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", { name: i18n.t("language.label") }),
    )
    expect(
      await screen.findByRole("menuitem", { name: /Português/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: /English/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: /Español/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: /Portuguese/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("menuitem", { name: /Inglés/ })).not.toBeInTheDocument()
  })

  it("switches forgot-password copy to Spanish", async () => {
    renderPortal("/t/ficc/forgot-password")
    expect(
      await screen.findByRole("heading", { name: "Esqueci a senha" }),
    ).toBeInTheDocument()

    await chooseLanguage("Español")
    expect(
      await screen.findByRole("heading", { name: "Olvidé mi contraseña" }),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem("i18nextLng")).toBe("es")
  })
})
