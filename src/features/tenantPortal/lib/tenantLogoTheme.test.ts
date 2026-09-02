import { describe, expect, it } from "vitest"

import { inspectTenantLogoSvg } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"
import { resolveTenantLogoSurface } from "@/features/tenantPortal/lib/resolveTenantLogoSurface"
import { resolveTenantTheme } from "@/lib/resolveTenantTheme"

const PRIMARY = "#0B1F3A"
const SECONDARY = "#22D3EE"

function svg(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">${inner}</svg>`
}

describe("tenant logo background → theme", () => {
  it("uses the inspected black SVG background as the dark portal canvas", () => {
    const inspection = inspectTenantLogoSvg(
      svg(
        `<rect width="600" height="600" fill="#000000" /><circle cx="300" cy="300" r="80" fill="#22d3ee" />`,
      ),
    )

    const tokens = resolveTenantTheme({
      primaryColor: PRIMARY,
      secondaryColor: SECONDARY,
      logoBackgroundColor: inspection.backgroundColor,
      logoBackgroundIsDark:
        inspection.hasEmbeddedBackground && inspection.backgroundIsDark,
      resolvedTheme: "dark",
    })

    expect(inspection.hasEmbeddedBackground).toBe(true)
    expect(tokens.pageBackgroundBase).toBe("#000000")
    expect(
      resolveTenantLogoSurface({
        theme: "dark",
        inspection,
      }),
    ).toBe("none")
  })

  it("uses the inspected #101820 SVG background as the dark portal canvas", () => {
    const inspection = inspectTenantLogoSvg(
      svg(
        `<rect width="600" height="600" fill="#101820" /><circle cx="300" cy="300" r="80" fill="#22d3ee" />`,
      ),
    )

    const tokens = resolveTenantTheme({
      primaryColor: PRIMARY,
      secondaryColor: SECONDARY,
      logoBackgroundColor: inspection.backgroundColor,
      logoBackgroundIsDark:
        inspection.hasEmbeddedBackground && inspection.backgroundIsDark,
      resolvedTheme: "dark",
    })

    expect(tokens.pageBackgroundBase.toLowerCase()).toBe("#101820")
  })

  it("keeps the light canvas for the same dark-background SVG", () => {
    const inspection = inspectTenantLogoSvg(
      svg(
        `<rect width="600" height="600" fill="#000000" /><circle cx="300" cy="300" r="80" fill="#22d3ee" />`,
      ),
    )

    const tokens = resolveTenantTheme({
      primaryColor: PRIMARY,
      secondaryColor: SECONDARY,
      logoBackgroundColor: inspection.backgroundColor,
      logoBackgroundIsDark:
        inspection.hasEmbeddedBackground && inspection.backgroundIsDark,
      resolvedTheme: "light",
    })

    expect(tokens.pageBackgroundBase.toLowerCase()).not.toBe("#000000")
    expect(tokens.surface).toBe("#ffffff")
    expect(
      resolveTenantLogoSurface({
        theme: "light",
        inspection,
      }),
    ).toBe("none")
  })

  it("leaves a transparent SVG on the current tenant-theme dark canvas", () => {
    const inspection = inspectTenantLogoSvg(
      svg(`<circle cx="300" cy="300" r="80" fill="#22d3ee" />`),
    )
    const input = {
      primaryColor: PRIMARY,
      secondaryColor: SECONDARY,
      resolvedTheme: "dark" as const,
    }

    const tokens = resolveTenantTheme({
      ...input,
      logoBackgroundColor: inspection.backgroundColor,
      logoBackgroundIsDark:
        inspection.hasEmbeddedBackground && inspection.backgroundIsDark,
    })

    expect(inspection.hasEmbeddedBackground).toBe(false)
    expect(tokens).toEqual(resolveTenantTheme(input))
  })

  it("falls back safely for malformed SVG", () => {
    const inspection = inspectTenantLogoSvg("<svg><rect")
    const input = {
      primaryColor: PRIMARY,
      secondaryColor: SECONDARY,
      resolvedTheme: "dark" as const,
    }

    expect(inspection.hasEmbeddedBackground).toBe(false)
    expect(
      resolveTenantTheme({
        ...input,
        logoBackgroundColor: inspection.backgroundColor,
        logoBackgroundIsDark:
          inspection.hasEmbeddedBackground && inspection.backgroundIsDark,
      }),
    ).toEqual(resolveTenantTheme(input))
  })
})
