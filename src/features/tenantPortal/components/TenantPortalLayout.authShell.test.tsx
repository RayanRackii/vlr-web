import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { ThemeProvider } from "@/components/ThemeProvider"
import i18n from "@/lib/i18n"
import { TenantPortalLayout } from "@/features/tenantPortal/components/TenantPortalLayout"
import { PortalNotFoundRoute } from "@/features/tenantPortal/components/PortalNotFoundRoute"
import { TenantPortalLoginPage } from "@/features/tenantPortal/pages/TenantPortalLoginPage"
import { TenantPortalRegisterPage } from "@/features/tenantPortal/pages/TenantPortalRegisterPage"
import { fetchTenantBranding } from "@/features/tenantPortal/services/tenantPortalService"
import { tenantBrandingSchema } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

vi.mock("@/features/tenantPortal/services/tenantPortalService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/tenantPortal/services/tenantPortalService")
    >()
  return {
    ...actual,
    fetchTenantBranding: vi.fn(async () => ({
      subdomain: "acme",
      displayName: "Acme Club",
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
            <Route path="*" element={<PortalNotFoundRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe("tenant portal auth split shell", () => {
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
    await i18n.changeLanguage("pt-BR")
  })

  afterEach(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("shows tenant branding in the brand panel and hides the Rolvix wordmark on the login route", async () => {
    renderPortal("/t/acme")

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("tenantPortal.login.title"),
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Acme Club").length).toBeGreaterThan(0)
    expect(screen.getByRole("heading", { level: 1, name: "Acme Club" })).toBeInTheDocument()
    expect(screen.getByText(i18n.t("tenantPortal.login.welcomeDefault"))).toBeInTheDocument()
    expect(screen.getByText("AC")).toBeInTheDocument()
    expect(
      screen.getByText(i18n.t("tenantPortal.authPanel.poweredBy")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: i18n.t("landing.header.brandAria") }),
    ).not.toBeInTheDocument()
  })

  it("uses existing API branding fields and accepts optional aliases", async () => {
    const original = await fetchTenantBranding("acme")
    vi.mocked(fetchTenantBranding).mockResolvedValueOnce({
      ...original,
      welcomeTagline: "Reserve com a Acme.",
    })
    const view = renderPortal("/t/acme")
    expect(await screen.findByText("Reserve com a Acme.")).toBeInTheDocument()
    view.unmount()

    const aliases = tenantBrandingSchema.parse({
      ...original,
      secondaryColor: "#FFB347",
      welcomeText: "Boas-vindas à Acme.",
    })
    vi.mocked(fetchTenantBranding).mockResolvedValueOnce(aliases)
    renderPortal("/t/acme")
    expect(await screen.findByText("Boas-vindas à Acme.")).toBeInTheDocument()
    expect(screen.getByRole("main").parentElement).toHaveStyle({ "--tenant-secondary": "#ffb347" })
  })

  it("shows tenant branding in the brand panel on the register route too", async () => {
    renderPortal("/t/acme/register")

    expect(
      await screen.findByRole("heading", {
        name: i18n.t("tenantPortal.register.title"),
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Acme Club").length).toBeGreaterThan(0)
    expect(
      screen.getByText(i18n.t("tenantPortal.authPanel.poweredBy")),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: i18n.t("landing.header.brandAria") }),
    ).not.toBeInTheDocument()
  })

  it("keeps the centered card layout with the Rolvix wordmark on other public routes", async () => {
    renderPortal("/t/acme/missing-route")

    expect(
      await screen.findByRole("link", {
        name: i18n.t("landing.header.brandAria"),
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(i18n.t("tenantPortal.authPanel.poweredBy")),
    ).not.toBeInTheDocument()
  })
})
