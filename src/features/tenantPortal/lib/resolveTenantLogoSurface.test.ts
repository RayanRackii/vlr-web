import { describe, expect, it } from "vitest"

import type { TenantLogoBackgroundInspection } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"
import { resolveTenantLogoSurface } from "@/features/tenantPortal/lib/resolveTenantLogoSurface"

const none: TenantLogoBackgroundInspection = {
  hasEmbeddedBackground: false,
  backgroundColor: null,
  backgroundIsDark: false,
  backgroundIsLight: false,
}

const darkBackground: TenantLogoBackgroundInspection = {
  hasEmbeddedBackground: true,
  backgroundColor: "#000000",
  backgroundIsDark: true,
  backgroundIsLight: false,
}

const lightBackground: TenantLogoBackgroundInspection = {
  hasEmbeddedBackground: true,
  backgroundColor: "#ffffff",
  backgroundIsDark: false,
  backgroundIsLight: true,
}

describe("resolveTenantLogoSurface", () => {
  it("does not adapt a transparent logo", () => {
    expect(
      resolveTenantLogoSurface({ theme: "dark", inspection: none }),
    ).toBe("none")
  })

  it("uses a light surface for a dark-background logo in dark theme", () => {
    expect(
      resolveTenantLogoSurface({
        theme: "dark",
        inspection: darkBackground,
      }),
    ).toBe("light")
  })

  it("does not adapt a dark-background logo in light theme", () => {
    expect(
      resolveTenantLogoSurface({
        theme: "light",
        inspection: darkBackground,
      }),
    ).toBe("none")
  })

  it("uses a neutral surface for a light-background logo in light theme", () => {
    expect(
      resolveTenantLogoSurface({
        theme: "light",
        inspection: lightBackground,
      }),
    ).toBe("neutral")
  })

  it("never adapts when the override is original", () => {
    expect(
      resolveTenantLogoSurface({
        theme: "dark",
        inspection: darkBackground,
        renderMode: "original",
      }),
    ).toBe("none")
  })

  it("adapts when the override is adaptive-surface even in light theme", () => {
    expect(
      resolveTenantLogoSurface({
        theme: "light",
        inspection: darkBackground,
        renderMode: "adaptive-surface",
      }),
    ).toBe("light")
  })
})
