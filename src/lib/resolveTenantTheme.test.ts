import { describe, expect, it } from "vitest"

import {
  contrastRatio,
  formatHex,
  mixRgb,
  parseCssHex,
  relativeLuminance,
} from "@/lib/colorUtils"
import { resolveTenantTheme, tenantReadableInk, tenantReadableLink } from "@/lib/resolveTenantTheme"

const DARK_BRAND = "#0B1F3A"
const LIGHT_BRAND = "#E8F4FF"
const CYAN = "#22D3EE"
const PALE_LIME = "#D4F56A"

describe("tenant auth contrast", () => {
  const colors = ["#E6EE5A", "#1E4FD8", "#000000", "#ffffff", "#777777", "#ff0000", "#5a8fa0"]
  it.each(colors)("keeps readable ink on %s without changing the brand fill", (primary) => {
    expect(contrastRatio(parseCssHex(primary)!, parseCssHex(tenantReadableInk(primary))!)).toBeGreaterThanOrEqual(4.5)
    for (const resolvedTheme of ["light", "dark"]) {
      const theme = resolveTenantTheme({ primaryColor: primary, resolvedTheme, auth: true })
      expect(theme.primary).toBe(primary.toLowerCase())
      expect(contrastRatio(parseCssHex(theme.primary)!, parseCssHex(theme.primaryForeground)!)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(parseCssHex(theme.surface)!, parseCssHex(theme.auth!.link)!)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(["#ffffff", "#191c16"])("adjusts links to 4.5:1 on %s", (surface) => {
    for (const primary of colors) {
      const link = tenantReadableLink(primary, surface)
      expect(contrastRatio(parseCssHex(link)!, parseCssHex(surface)!)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it("preserves a primary that already has enough contrast", () => {
    expect(tenantReadableLink("#1E4FD8", "#ffffff")).toBe("#1e4fd8")
  })

  it("derives a secondary color and safely handles invalid colors", () => {
    const theme = resolveTenantTheme({ primaryColor: "#E6EE5A", auth: true })
    expect(theme.auth!.secondary).not.toBe(theme.primary)
    expect(() => resolveTenantTheme({ primaryColor: "invalid", secondaryColor: "invalid", auth: true })).not.toThrow()
  })

  it("covers the RGB range, including borderline ink and link luminance", () => {
    for (const r of [0, 64, 128, 192, 255]) {
      for (const g of [0, 64, 128, 192, 255]) {
        for (const b of [0, 64, 128, 192, 255]) {
          const color = `rgb(${r}, ${g}, ${b})`
          expect(contrastRatio({ r, g, b }, parseCssHex(tenantReadableInk(color))!)).toBeGreaterThanOrEqual(4.5)
          for (const surface of ["#ffffff", "#191c16"]) {
            expect(contrastRatio(parseCssHex(surface)!, parseCssHex(tenantReadableLink(color, surface))!)).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    }
  })

  it.each(["#000000", "#ffffff", "#E6EE5A", "#1E4FD8"])("keeps footer ink readable on its explicit blended backing for %s", (primaryColor) => {
    for (const secondaryColor of ["#000000", "#ffffff", "#FFCDBE", "#FFB347"]) {
      const theme = resolveTenantTheme({ primaryColor, secondaryColor, auth: true })
      const backing = mixRgb(parseCssHex(primaryColor)!, parseCssHex(secondaryColor)!, 0.55)
      expect(theme.auth!.footerBackground).toBe(formatHex(backing))
      expect(contrastRatio(parseCssHex(theme.auth!.footerBackground)!, parseCssHex(theme.auth!.footerForeground)!)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

function lastGradientHex(background: string): string {
  const matches = background.match(/#[0-9a-fA-F]{6}/g)
  if (!matches || matches.length === 0) {
    throw new Error("expected hex stops in pageBackground")
  }
  return matches[matches.length - 1]!
}

function luminanceOfBackground(background: string): number {
  const rgb = parseCssHex(lastGradientHex(background))
  if (!rgb) {
    throw new Error("invalid hex")
  }
  return relativeLuminance(rgb)
}

describe("resolveTenantTheme", () => {
  it("keeps a light wash and dark text for dark tenant colors in light theme", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      resolvedTheme: "light",
    })

    expect(luminanceOfBackground(tokens.pageBackground)).toBeGreaterThan(0.75)
    expect(tokens.text).toBe("#0f172a")
    expect(tokens.surface).toBe("#ffffff")
    expect(tokens.primary.toLowerCase()).toBe(DARK_BRAND.toLowerCase())
  })

  it("uses a genuinely dark wash for dark tenant colors in dark theme", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      resolvedTheme: "dark",
    })

    expect(luminanceOfBackground(tokens.pageBackground)).toBeLessThan(0.2)
    expect(tokens.text).toBe("#f8fafc")
    expect(relativeLuminance(parseCssHex(tokens.surface)!)).toBeLessThan(0.25)
    expect(tokens.primary.toLowerCase()).not.toBe("#ffffff")
  })

  it("does not let a very light tenant color force a bright dark-theme page", () => {
    const tokens = resolveTenantTheme({
      primaryColor: LIGHT_BRAND,
      secondaryColor: LIGHT_BRAND,
      resolvedTheme: "dark",
    })

    expect(luminanceOfBackground(tokens.pageBackground)).toBeLessThan(0.22)
    expect(tokens.text).toBe("#f8fafc")
  })

  it("keeps a very light tenant color as a soft tint in light theme", () => {
    const tokens = resolveTenantTheme({
      primaryColor: LIGHT_BRAND,
      secondaryColor: LIGHT_BRAND,
      resolvedTheme: "light",
    })

    expect(luminanceOfBackground(tokens.pageBackground)).toBeGreaterThan(0.85)
    expect(tokens.text).toBe("#0f172a")
  })

  it("recomputes branding when the theme switches", () => {
    const input = {
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
    }
    const light = resolveTenantTheme({ ...input, resolvedTheme: "light" })
    const dark = resolveTenantTheme({ ...input, resolvedTheme: "dark" })

    expect(light.pageBackground).not.toBe(dark.pageBackground)
    expect(luminanceOfBackground(light.pageBackground)).toBeGreaterThan(
      luminanceOfBackground(dark.pageBackground),
    )
  })

  it("falls back to Rolvix defaults when tenant colors are missing", () => {
    const tokens = resolveTenantTheme({
      primaryColor: null,
      secondaryColor: undefined,
      resolvedTheme: "light",
    })

    expect(tokens.primary.toLowerCase()).toBe("#4d6a92")
    expect(luminanceOfBackground(tokens.pageBackground)).toBeGreaterThan(0.7)
  })

  it("falls back to Rolvix defaults when tenant colors are invalid", () => {
    const tokens = resolveTenantTheme({
      primaryColor: "not-a-color",
      secondaryColor: "???",
      resolvedTheme: "dark",
    })

    expect(tokens.primary.toLowerCase()).toBe("#4d6a92")
    expect(luminanceOfBackground(tokens.pageBackground)).toBeLessThan(0.22)
  })

  it("uses an exact black logo background as the dark canvas base", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "#000000",
      logoBackgroundIsDark: true,
      resolvedTheme: "dark",
    })

    expect(tokens.pageBackgroundBase).toBe("#000000")
    expect(lastGradientHex(tokens.pageBackground).toLowerCase()).toBe("#000000")
    expect(tokens.surface.toLowerCase()).not.toBe("#000000")
    expect(relativeLuminance(parseCssHex(tokens.surface)!)).toBeGreaterThan(
      relativeLuminance(parseCssHex("#000000")!),
    )
    expect(tokens.primary.toLowerCase()).toBe(DARK_BRAND.toLowerCase())
  })

  it("accepts a named black SVG fill as the dark canvas base", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "black",
      logoBackgroundIsDark: true,
      resolvedTheme: "dark",
    })

    expect(tokens.pageBackgroundBase).toBe("#000000")
  })

  it("accepts a named navy SVG fill as the dark canvas base", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "navy",
      logoBackgroundIsDark: true,
      resolvedTheme: "dark",
    })

    expect(tokens.pageBackgroundBase.toLowerCase()).toBe("#000080")
  })

  it("uses an exact #101820 logo background as the dark canvas base", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "#101820",
      logoBackgroundIsDark: true,
      resolvedTheme: "dark",
    })

    expect(tokens.pageBackgroundBase.toLowerCase()).toBe("#101820")
    expect(lastGradientHex(tokens.pageBackground).toLowerCase()).toBe("#101820")
    expect(tokens.surface.toLowerCase()).not.toBe("#101820")
  })

  it("keeps a light canvas when the same dark-background logo is shown in light theme", () => {
    const tokens = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "#000000",
      logoBackgroundIsDark: true,
      resolvedTheme: "light",
    })

    expect(tokens.pageBackgroundBase.toLowerCase()).not.toBe("#000000")
    expect(luminanceOfBackground(tokens.pageBackground)).toBeGreaterThan(0.75)
    expect(tokens.surface).toBe("#ffffff")
    expect(tokens.text).toBe("#0f172a")
  })

  it("does not let a transparent logo change the current dark tenant-theme canvas", () => {
    const input = {
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      resolvedTheme: "dark" as const,
    }
    const withoutLogo = resolveTenantTheme(input)
    const transparentLogo = resolveTenantTheme({
      ...input,
      logoBackgroundColor: null,
      logoBackgroundIsDark: false,
    })

    expect(transparentLogo).toEqual(withoutLogo)
    expect(transparentLogo.pageBackgroundBase.toLowerCase()).not.toBe("#000000")
  })

  it("switches the canvas when theme toggles from dark to light with a dark logo background", () => {
    const input = {
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "#101820",
      logoBackgroundIsDark: true,
    }
    const dark = resolveTenantTheme({ ...input, resolvedTheme: "dark" })
    const light = resolveTenantTheme({ ...input, resolvedTheme: "light" })

    expect(dark.pageBackgroundBase.toLowerCase()).toBe("#101820")
    expect(light.pageBackgroundBase.toLowerCase()).not.toBe("#101820")
    expect(luminanceOfBackground(light.pageBackground)).toBeGreaterThan(
      luminanceOfBackground(dark.pageBackground),
    )
  })

  it("darkens a pale brand color in light theme so buttons don't blend into the white surface", () => {
    const tokens = resolveTenantTheme({
      primaryColor: PALE_LIME,
      secondaryColor: PALE_LIME,
      resolvedTheme: "light",
    })

    const fill = parseCssHex(tokens.primary)!
    const foreground = parseCssHex(tokens.primaryForeground)!
    expect(contrastRatio(fill, { r: 255, g: 255, b: 255 })).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(fill, foreground)).toBeGreaterThanOrEqual(4.5)
  })

  it("ignores an unparseable logo background and keeps the tenant-color dark canvas", () => {
    const fallback = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      resolvedTheme: "dark",
    })
    const malformed = resolveTenantTheme({
      primaryColor: DARK_BRAND,
      secondaryColor: CYAN,
      logoBackgroundColor: "not-a-color",
      logoBackgroundIsDark: true,
      resolvedTheme: "dark",
    })

    expect(malformed).toEqual(fallback)
  })
})
