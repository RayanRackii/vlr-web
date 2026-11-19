import { contrastRatio, formatHex, mixRgb, parseCssHex, type Rgb } from "@/lib/colorUtils"

const NEUTRAL_DARK = "#0f172a"
const BLACK: Rgb = { r: 0, g: 0, b: 0 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const HERO_FLOOR: Rgb = { r: 11, g: 18, b: 32 }

/** Solid hero backdrop when the company has no landing image: its primary colour, darkened. */
export function heroSolidBackground(primaryColor?: string | null): string {
  const rgb = parseCssHex(primaryColor)
  if (!rgb) return NEUTRAL_DARK
  return formatHex(mixRgb(rgb, BLACK, 0.72))
}

/** Kicker colour: the company primary when readable on the dark hero, otherwise near-white. */
export function heroAccentColor(primaryColor?: string | null): string {
  const rgb = parseCssHex(primaryColor)
  if (!rgb || contrastRatio(rgb, HERO_FLOOR) < 4.5) return formatHex(mixRgb(WHITE, HERO_FLOOR, 0.1))
  return formatHex(rgb)
}

export type PortalHeroCopy = {
  kicker: string | null
  headline: string
  subtitle: string
}

function clean(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Hero texts with defaults: no kicker, headline = display name, subtitle = tagline or a generic line. */
export function resolveHeroCopy(
  branding: {
    displayName: string
    welcomeText?: string | null
    welcomeTagline?: string | null
    landingKicker?: string | null
    landingHeadline?: string | null
    landingSubtitle?: string | null
  },
  fallbackSubtitle: string,
): PortalHeroCopy {
  return {
    kicker: clean(branding.landingKicker),
    headline: clean(branding.landingHeadline) ?? branding.displayName,
    subtitle:
      clean(branding.landingSubtitle) ??
      clean(branding.welcomeText) ??
      clean(branding.welcomeTagline) ??
      fallbackSubtitle,
  }
}
