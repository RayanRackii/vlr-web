export type Rgb = {
  r: number
  g: number
  b: number
}

const WHITE: Rgb = { r: 248, g: 250, b: 252 }
const INK: Rgb = { r: 15, g: 23, b: 42 }

export function parseCssHex(raw: string | null | undefined): Rgb | null {
  if (raw == null) {
    return null
  }

  const value = raw.trim()
  if (!value.startsWith("#")) {
    return null
  }

  const hex = value.slice(1)
  if (hex.length === 3) {
    const r = Number.parseInt(hex[0]! + hex[0], 16)
    const g = Number.parseInt(hex[1]! + hex[1], 16)
    const b = Number.parseInt(hex[2]! + hex[2], 16)
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? { r, g, b }
      : null
  }

  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
      ? { r, g, b }
      : null
  }

  return null
}

export function formatHex(rgb: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`
}

export function mixRgb(from: Rgb, toward: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount))
  return {
    r: from.r + (toward.r - from.r) * t,
    g: from.g + (toward.g - from.g) * t,
    b: from.b + (toward.b - from.b) * t,
  }
}

export function relativeLuminance(rgb: Rgb): number {
  const toLinear = (channel: number) => {
    const scaled = channel / 255
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b))
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

export function contrastForeground(background: Rgb): string {
  return contrastRatio(background, WHITE) >= contrastRatio(background, INK)
    ? formatHex(WHITE)
    : formatHex(INK)
}

/** Keep the brand fill when possible; shift luminance only when neither white nor ink text is readable. */
export function readableFill(color: Rgb, theme: "light" | "dark"): Rgb {
  if (
    contrastRatio(color, WHITE) >= 4.5 ||
    contrastRatio(color, INK) >= 4.5
  ) {
    return color
  }

  let candidate = color
  const toward = theme === "dark" ? WHITE : INK
  for (let step = 0; step < 8; step += 1) {
    candidate = mixRgb(candidate, toward, 0.18)
    if (
      contrastRatio(candidate, WHITE) >= 4.5 ||
      contrastRatio(candidate, INK) >= 4.5
    ) {
      return candidate
    }
  }

  return theme === "dark" ? mixRgb(color, WHITE, 0.4) : mixRgb(color, INK, 0.35)
}
