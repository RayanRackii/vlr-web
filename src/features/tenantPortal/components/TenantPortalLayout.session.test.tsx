import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"

import { ThemeProvider } from "@/components/ThemeProvider"
import i18n from "@/lib/i18n"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { TenantPortalForgotPasswordPage } from "@/features/tenantPortal/pages/TenantPortalForgotPasswordPage"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import {
  clearCustomerSession,
  persistCustomerSession,
} from "@/features/tenantPortal/services/tenantPortalService"

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchTenantBranding: vi.fn(() => new Promise(() => undefined)),
    fetchRegistrationSchema: vi.fn(() => new Promise(() => undefined)),
  }
})

import { fetchTenantBranding } from "@/features/tenantPortal/services/tenantPortalService"

const fetchBranding = vi.mocked(fetchTenantBranding)

function portalRouter(initialEntries: string[], initialIndex = 0) {
  return createMemoryRouter(
    [
      {
        path: "/t/:subdomain",
        element: <TenantPortalLayout />,
        children: [
          { index: true, element: <TenantPortalLoginPage /> },
          { path: "register", element: <TenantPortalRegisterPage /> },
          {
            path: "forgot-password",
            element: <TenantPortalForgotPasswordPage />,
          },
        ],
      },
      {
        path: "/t/:subdomain/app",
        element: <div>customer-app</div>,
      },
    ],
    { initialEntries, initialIndex },
  )
}

function renderPortal(initialEntries: string[], initialIndex = 0) {
  const router = portalRouter(initialEntries, initialIndex)
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  return router
}

describe("signed-in public portal shell", () => {
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
    clearCustomerSession()
    fetchBranding.mockClear()
    await i18n.changeLanguage("pt-BR")
  })

  afterEach(async () => {
    clearCustomerSession()
    await i18n.changeLanguage("pt-BR")
  })

  it("opens a new tab on the app instead of the logged-out landing", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    const router = renderPortal(["/t/ficc"])

    expect(await screen.findByText("customer-app")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/t/ficc/app")
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Começar agora" })).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
  })

  it("replaces /register when a signed-in customer arrives via Back", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    const router = renderPortal(["/t/ficc/app", "/t/ficc/register"], 1)

    expect(await screen.findByText("customer-app")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/t/ficc/app")
    expect(
      screen.queryByRole("heading", { name: "Criar conta" }),
    ).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()

    await act(async () => {
      await router.navigate(-1)
    })

    expect(router.state.location.pathname).toBe("/t/ficc/app")
    expect(
      screen.queryByRole("heading", { name: "Criar conta" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument()
  })

  it("replaces /login when a signed-in customer arrives via Back", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    const router = renderPortal(["/t/ficc/app", "/t/ficc"], 1)

    expect(await screen.findByText("customer-app")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/t/ficc/app")

    await act(async () => {
      await router.navigate(-1)
    })

    expect(router.state.location.pathname).toBe("/t/ficc/app")
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument()
  })

  it("keeps password reset reachable when a customer session exists", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "FICC",
      logoSvg: null,
      primaryColor: "#D4FF00",
      accentColor: "#FF0000",
      welcomeTagline: null,
    })
    const router = renderPortal(["/t/ficc/forgot-password"])

    expect(
      await screen.findByRole("heading", { name: "Esqueci a senha" }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/t/ficc/forgot-password")
    expect(screen.queryByText("customer-app")).not.toBeInTheDocument()
  })
})
