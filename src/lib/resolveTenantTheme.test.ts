import { describe, expect, it } from "vitest"

import {
  parseCssHex,
  relativeLuminance,
} from "@/lib/colorUtils"
import { resolveTenantTheme } from "@/lib/resolveTenantTheme"

const DARK_BRAND = "#0B1F3A"
const LIGHT_BRAND = "#E8F4FF"
const CYAN = "#22D3EE"

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
})
