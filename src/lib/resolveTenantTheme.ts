import type { CSSProperties } from "react"

import {
  ROLVIX_ACCENT_COLOR,
  ROLVIX_PRIMARY_COLOR,
} from "@/lib/brandColors"
import {
  contrastForeground,
  formatHex,
  mixRgb,
  parseCssHex,
  readableFill,
  relativeLuminance,
  type Rgb,
} from "@/lib/colorUtils"

export type TenantResolvedTheme = "light" | "dark"

export type TenantThemeTokens = {
  pageBackground: string
  pageBackgroundBase: string
  pageBackgroundAccent: string
  surface: string
  surfaceMuted: string
  border: string
  text: string
  textMuted: string
  primary: string
  primaryForeground: string
  accent: string
}

const LIGHT_PAPER: Rgb = { r: 255, g: 255, b: 255 }
const DARK_PAPER: Rgb = { r: 11, g: 18, b: 32 }
const DARK_SURFACE: Rgb = { r: 30, g: 41, b: 59 }
const LIGHT_MUTED_TEXT: Rgb = { r: 100, g: 116, b: 139 }
const DARK_MUTED_TEXT: Rgb = { r: 148, g: 163, b: 184 }
const PAPER_WHITE: Rgb = { r: 248, g: 250, b: 252 }

export function resolveTenantTheme(options: {
  primaryColor?: string | null
  secondaryColor?: string | null
  logoBackgroundColor?: string | null
  logoBackgroundIsDark?: boolean
  resolvedTheme?: string | null
}): TenantThemeTokens {
  const theme: TenantResolvedTheme =
    options.resolvedTheme === "dark" ? "dark" : "light"
  const primary =
    parseCssHex(options.primaryColor) ?? parseCssHex(ROLVIX_PRIMARY_COLOR)!
  const secondary =
    parseCssHex(options.secondaryColor) ??
    parseCssHex(options.primaryColor) ??
    parseCssHex(ROLVIX_ACCENT_COLOR)!
  const parsedLogo =
    options.logoBackgroundIsDark === true
      ? parseCssHex(options.logoBackgroundColor)
      : null
  const logoCanvas =
    parsedLogo && relativeLuminance(parsedLogo) < 0.45 ? parsedLogo : null

  const buttonFill = readableFill(primary, theme)
  const accentFill = readableFill(secondary, theme)

  if (theme === "dark" && logoCanvas) {
    const canvasHex = formatHex(logoCanvas)
    const surface = mixRgb(logoCanvas, PAPER_WHITE, 0.14)
    return {
      pageBackground: logoMatchedDarkBackground(logoCanvas, primary, secondary),
      pageBackgroundBase: canvasHex,
      pageBackgroundAccent: formatHex(mixRgb(logoCanvas, secondary, 0.16)),
      surface: formatHex(surface),
      surfaceMuted: canvasHex,
      border: "rgb(255 255 255 / 14%)",
      text: "#f8fafc",
      textMuted: formatHex(DARK_MUTED_TEXT),
      primary: formatHex(buttonFill),
      primaryForeground: contrastForeground(buttonFill),
      accent: formatHex(accentFill),
    }
  }

  const paper = theme === "dark" ? DARK_PAPER : LIGHT_PAPER
  const tintAmount = theme === "dark" ? 0.14 : 0.1
  const wash = mixRgb(paper, primary, tintAmount)
  const washAccent = mixRgb(paper, secondary, tintAmount * 1.1)

  if (theme === "dark") {
    return {
      pageBackground: darkGradient(primary, secondary, wash, washAccent),
      pageBackgroundBase: formatHex(wash),
      pageBackgroundAccent: formatHex(washAccent),
      surface: formatHex(DARK_SURFACE),
      surfaceMuted: formatHex(mixRgb(DARK_PAPER, primary, 0.08)),
      border: "rgb(255 255 255 / 14%)",
      text: "#f8fafc",
      textMuted: formatHex(DARK_MUTED_TEXT),
      primary: formatHex(buttonFill),
      primaryForeground: contrastForeground(buttonFill),
      accent: formatHex(accentFill),
    }
  }

  return {
    pageBackground: lightGradient(primary, secondary, wash, washAccent),
    pageBackgroundBase: formatHex(wash),
    pageBackgroundAccent: formatHex(washAccent),
    surface: "#ffffff",
    surfaceMuted: formatHex(mixRgb(LIGHT_PAPER, primary, 0.06)),
    border: "rgb(15 23 42 / 12%)",
    text: "#0f172a",
    textMuted: formatHex(LIGHT_MUTED_TEXT),
    primary: formatHex(buttonFill),
    primaryForeground: contrastForeground(buttonFill),
    accent: formatHex(accentFill),
  }
}

export function tenantThemeCssVars(tokens: TenantThemeTokens): CSSProperties {
  return {
    "--primary": tokens.primary,
    "--primary-foreground": tokens.primaryForeground,
    "--ring": tokens.accent,
  } as CSSProperties
}

export function tenantThemeStyle(tokens: TenantThemeTokens): CSSProperties {
  return {
    ...tenantThemeCssVars(tokens),
    color: tokens.text,
    background: tokens.pageBackground,
    "--background": tokens.pageBackgroundBase,
  } as CSSProperties
}

function lightGradient(
  primary: Rgb,
  secondary: Rgb,
  wash: Rgb,
  washAccent: Rgb,
): string {
  return [
    `radial-gradient(ellipse 85% 65% at 12% 0%, ${formatHex(mixRgb(wash, primary, 0.18))}66, transparent 70%)`,
    `radial-gradient(ellipse 70% 55% at 100% 18%, ${formatHex(mixRgb(washAccent, secondary, 0.16))}59, transparent 72%)`,
    `linear-gradient(135deg, ${formatHex(wash)}, ${formatHex(washAccent)} 52%, ${formatHex(mixRgb(wash, secondary, 0.08))})`,
  ].join(", ")
}

function darkGradient(
  primary: Rgb,
  secondary: Rgb,
  wash: Rgb,
  washAccent: Rgb,
): string {
  return [
    `radial-gradient(ellipse 85% 65% at 12% 0%, ${formatHex(mixRgb(wash, primary, 0.28))}40, transparent 70%)`,
    `radial-gradient(ellipse 70% 55% at 100% 18%, ${formatHex(mixRgb(washAccent, secondary, 0.24))}36, transparent 72%)`,
    `linear-gradient(135deg, ${formatHex(wash)}, ${formatHex(washAccent)} 58%, ${formatHex(mixRgb(DARK_PAPER, secondary, 0.1))})`,
  ].join(", ")
}

function logoMatchedDarkBackground(
  canvas: Rgb,
  primary: Rgb,
  secondary: Rgb,
): string {
  const canvasHex = formatHex(canvas)
  return [
    `radial-gradient(ellipse 85% 65% at 12% 0%, ${formatHex(mixRgb(canvas, primary, 0.22))}33, transparent 70%)`,
    `radial-gradient(ellipse 70% 55% at 100% 18%, ${formatHex(mixRgb(canvas, secondary, 0.18))}2e, transparent 72%)`,
    canvasHex,
  ].join(", ")
}
