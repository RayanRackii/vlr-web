import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryRouter } from "react-router-dom"

import { ThemeProvider } from "@/components/ThemeProvider"
import i18n from "@/lib/i18n"
import { PortalAuthLayout } from "@/features/tenantPortal/components/PortalAuthLayout"
import type { TenantBranding } from "@/features/tenantPortal/schemas/tenantPortalSchemas"
import { tenantBrandingSchema } from "@/features/tenantPortal/schemas/tenantPortalSchemas"

const base: TenantBranding = {
  subdomain: "acme",
  displayName: "Acme Club",
  logoSvg: '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>',
  primaryColor: "#D4FF00",
  accentColor: null,
  welcomeTagline: null,
}

function renderLayout(branding: TenantBranding, recovery = false) {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <PortalAuthLayout branding={branding} headlineAsParagraph={recovery}>
          <form aria-label="form-slot" />
        </PortalAuthLayout>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe("PortalAuthLayout", () => {
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

  it("renders a solid hero with defaults when there is no landing image", () => {
    const { container } = renderLayout(base)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector(".tenant-hero")).toHaveAttribute("data-hero-image", "false")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Acme Club")
    expect(screen.getByText(i18n.t("tenantPortal.login.welcomeDefault"))).toBeInTheDocument()
    expect(screen.getAllByText(i18n.t("tenantPortal.redesign.customerPortal")).length).toBeGreaterThan(0)
    expect(screen.getByText(i18n.t("tenantPortal.authPanel.poweredBy"))).toBeInTheDocument()
    expect(screen.getAllByRole("img", { name: "Acme Club" })).toHaveLength(2)
    expect(screen.getByRole("form", { name: "form-slot" })).toBeInTheDocument()
  })

  it("renders the landing image, kicker, headline and subtitle when provided", () => {
    const { container } = renderLayout({
      ...base,
      landingImageUrl: "https://cdn.example/hero.webp",
      landingKicker: "Seu clube. Seu tempo.",
      landingHeadline: "Mais momentos",
      landingSubtitle: "Reserve seu próximo jogo.",
    })
    const img = container.querySelector("img.object-cover")
    expect(img).toHaveAttribute("src", "https://cdn.example/hero.webp")
    expect(img).toHaveAttribute("alt", "")
    expect(screen.getByText("Seu clube. Seu tempo.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mais momentos")
    expect(screen.getByText("Reserve seu próximo jogo.")).toBeInTheDocument()
  })

  it("falls back to the solid hero when the image fails to load", () => {
    const { container } = renderLayout({ ...base, landingImageUrl: "https://cdn.example/broken.webp" })
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector(".tenant-hero")).toHaveAttribute("data-hero-image", "false")
  })

  it("tries a later valid image URL after an earlier one failed", () => {
    const { container, rerender } = renderLayout({ ...base, landingImageUrl: "https://cdn.example/broken.webp" })
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    rerender(
      <ThemeProvider>
        <MemoryRouter>
          <PortalAuthLayout branding={{ ...base, landingImageUrl: "https://cdn.example/ok.webp" }}>
            <form aria-label="form-slot" />
          </PortalAuthLayout>
        </MemoryRouter>
      </ThemeProvider>,
    )
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example/ok.webp")
    expect(container.querySelector(".tenant-hero")).toHaveAttribute("data-hero-image", "true")
  })

  it("keeps a single h1 on recovery pages and collapses to a banner below lg", () => {
    const { container } = renderLayout(base, true)
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    expect(container.querySelector(".tenant-hero-headline")?.tagName).toBe("P")
    expect(container.querySelector(".tenant-hero-subtitle")).not.toBeNull()
    // Reserves room for the absolutely positioned toggles so the name is never covered.
    expect(screen.getByTestId("portal-hero-brand")).toHaveClass("max-lg:pr-28")
    expect(container.querySelector("main")).toHaveClass("lg:grid-cols-2")
  })

  it("accepts the landing fields as optional and nullable in the branding schema", () => {
    expect(tenantBrandingSchema.parse(base).landingImageUrl).toBeUndefined()
    const parsed = tenantBrandingSchema.parse({
      ...base,
      landingImageUrl: null,
      landingKicker: null,
      landingHeadline: "H",
      landingSubtitle: null,
    })
    expect(parsed.landingHeadline).toBe("H")
  })
})
