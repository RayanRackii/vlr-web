import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "next-themes"

import { CustomerAppLayout } from "@/features/tenantPortal/components/CustomerAppLayout"
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
    fetchTenantBranding: vi.fn(),
    fetchTenantMenu: vi.fn(),
  }
})

import {
  fetchTenantBranding,
  fetchTenantMenu,
} from "@/features/tenantPortal/services/tenantPortalService"

const fetchBranding = vi.mocked(fetchTenantBranding)
const fetchMenu = vi.mocked(fetchTenantMenu)

function renderPortal(path: string) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/t/:subdomain" element={<div>login-form</div>} />
          <Route path="/t/:subdomain/agenda" element={<CustomerAppLayout />}>
            <Route index element={<div>agenda-body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe("CustomerAppLayout session tenant", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  })

  afterEach(() => {
    clearCustomerSession()
    fetchBranding.mockReset()
    fetchMenu.mockReset()
  })

  it("sends a signed-out visit to the login form", async () => {
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("login-form")).toBeInTheDocument()
    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
  })

  it("does not open this tenant with a session saved for another tenant", async () => {
    persistCustomerSession("customer-token", "other-club", "Ana")
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("login-form")).toBeInTheDocument()
    expect(screen.queryByText("agenda-body")).not.toBeInTheDocument()
    expect(fetchBranding).not.toHaveBeenCalled()
    expect(fetchMenu).not.toHaveBeenCalled()
  })

  it("opens the signed-in shell when the session matches this tenant", async () => {
    persistCustomerSession("customer-token", "ficc", "Ana")
    fetchBranding.mockResolvedValue({
      subdomain: "ficc",
      displayName: "Club",
      logoSvg: null,
      primaryColor: "#123456",
      accentColor: null,
      welcomeTagline: null,
    })
    fetchMenu.mockResolvedValue([])
    renderPortal("/t/ficc/agenda")

    expect(await screen.findByText("agenda-body")).toBeInTheDocument()
    expect(screen.queryByText("login-form")).not.toBeInTheDocument()
    expect(fetchBranding).toHaveBeenCalledWith("ficc")
  })
})
