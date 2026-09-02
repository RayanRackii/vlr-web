export type TenantLogoBackgroundInspection = {
  hasEmbeddedBackground: boolean
  backgroundColor: string | null
  backgroundIsDark: boolean
  backgroundIsLight: boolean
}

const EMPTY_INSPECTION: TenantLogoBackgroundInspection = {
  hasEmbeddedBackground: false,
  backgroundColor: null,
  backgroundIsDark: false,
  backgroundIsLight: false,
}

const COVER_RATIO = 0.85
const DARK_LUMINANCE = 0.45
const LIGHT_LUMINANCE = 0.65

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  navy: "#000080",
  maroon: "#800000",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  lime: "#00ff00",
  aqua: "#00ffff",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  teal: "#008080",
  olive: "#808000",
}

type ViewBox = {
  minX: number
  minY: number
  width: number
  height: number
}

type RectBox = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Structural SVG inspection for embedded solid backgrounds.
 * Does not mutate markup and does not execute SVG.
 */
export function inspectTenantLogoSvg(
  raw: string | null | undefined,
): TenantLogoBackgroundInspection {
  if (raw == null || raw.trim().length === 0) {
    return EMPTY_INSPECTION
  }

  if (typeof DOMParser === "undefined") {
    return EMPTY_INSPECTION
  }

  try {
    const document = new DOMParser().parseFromString(
      raw.trim(),
      "image/svg+xml",
    )

    if (document.querySelector("parsererror")) {
      return EMPTY_INSPECTION
    }

    const svg = document.documentElement
    if (!svg || svg.localName.toLowerCase() !== "svg") {
      return EMPTY_INSPECTION
    }

    const viewBox = readViewBox(svg)
    if (!viewBox) {
      return EMPTY_INSPECTION
    }

    const rootFill = readSolidFill(svg)
    if (rootFill) {
      return inspectionFromFill(rootFill)
    }

    const candidates = [
      ...Array.from(svg.querySelectorAll("rect")),
      ...Array.from(svg.querySelectorAll("path")),
    ].filter((element) => isPaintedContent(element))

    let best: { ratio: number; fill: string } | null = null

    for (const element of candidates) {
      const fill = readSolidFill(element)
      if (!fill) {
        continue
      }

      const box =
        element.localName.toLowerCase() === "rect"
          ? readRectBox(element, viewBox)
          : readSimplePathBox(element.getAttribute("d"))

      if (!box) {
        continue
      }

      const ratio = coverageRatio(box, viewBox)
      if (ratio < COVER_RATIO) {
        continue
      }

      if (!best || ratio > best.ratio) {
        best = { ratio, fill }
      }
    }

    if (!best) {
      return EMPTY_INSPECTION
    }

    return inspectionFromFill(best.fill)
  } catch {
    return EMPTY_INSPECTION
  }
}

function isPaintedContent(element: Element): boolean {
  return element.closest(
    "defs, mask, clipPath, pattern, symbol, linearGradient, radialGradient",
  ) == null
}

function inspectionFromFill(fill: string): TenantLogoBackgroundInspection {
  const rgb = parseCssColor(fill)
  if (!rgb) {
    return EMPTY_INSPECTION
  }

  const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b)
  return {
    hasEmbeddedBackground: true,
    backgroundColor: fill,
    backgroundIsDark: luminance < DARK_LUMINANCE,
    backgroundIsLight: luminance > LIGHT_LUMINANCE,
  }
}

function readViewBox(svg: Element): ViewBox | null {
  const raw = svg.getAttribute("viewBox")?.trim()
  if (raw) {
    const parts = raw.split(/[\s,]+/).map((part) => Number(part))
    if (
      parts.length === 4 &&
      parts.every((part) => Number.isFinite(part)) &&
      parts[2]! > 0 &&
      parts[3]! > 0
    ) {
      return {
        minX: parts[0]!,
        minY: parts[1]!,
        width: parts[2]!,
        height: parts[3]!,
      }
    }
  }

  const width = parseLength(svg.getAttribute("width"))
  const height = parseLength(svg.getAttribute("height"))
  if (width && height) {
    return { minX: 0, minY: 0, width, height }
  }

  return null
}

function readRectBox(element: Element, viewBox: ViewBox): RectBox | null {
  const x =
    parseUserCoord(element.getAttribute("x"), viewBox.minX, viewBox.width) ??
    viewBox.minX
  const y =
    parseUserCoord(element.getAttribute("y"), viewBox.minY, viewBox.height) ??
    viewBox.minY
  const width = parseLength(element.getAttribute("width"), viewBox.width)
  const height = parseLength(element.getAttribute("height"), viewBox.height)

  if (!width || !height || width <= 0 || height <= 0) {
    return null
  }

  return { x, y, width, height }
}

function readSimplePathBox(rawPath: string | null): RectBox | null {
  if (!rawPath) {
    return null
  }

  const points = traceSimplePath(rawPath)
  if (!points || points.length < 4) {
    return null
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY

  if (width <= 0 || height <= 0) {
    return null
  }

  const uniqueX = new Set(xs.map((value) => value.toFixed(2)))
  const uniqueY = new Set(ys.map((value) => value.toFixed(2)))
  if (uniqueX.size > 2 || uniqueY.size > 2) {
    return null
  }

  return { x: minX, y: minY, width, height }
}

function traceSimplePath(
  rawPath: string,
): Array<{ x: number; y: number }> | null {
  const tokens = rawPath
    .trim()
    .replace(/,/g, " ")
    .match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)

  if (!tokens) {
    return null
  }

  const points: Array<{ x: number; y: number }> = []
  let command = ""
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let index = 0

  const readNumber = (): number | null => {
    const token = tokens[index]
    if (token == null || /[A-Za-z]/.test(token)) {
      return null
    }
    index += 1
    const value = Number(token)
    return Number.isFinite(value) ? value : null
  }

  while (index < tokens.length) {
    const token = tokens[index]!
    if (/^[A-Za-z]$/.test(token)) {
      if (!/^[MmLlHhVvZz]$/.test(token)) {
        return null
      }
      command = token
      index += 1
      if (/^[Zz]$/.test(command)) {
        x = startX
        y = startY
        points.push({ x, y })
      }
      continue
    }

    if (!command) {
      return null
    }

    if (command === "M" || command === "L") {
      const nextX = readNumber()
      const nextY = readNumber()
      if (nextX == null || nextY == null) {
        return null
      }
      x = nextX
      y = nextY
      if (command === "M") {
        startX = x
        startY = y
        command = "L"
      }
      points.push({ x, y })
      continue
    }

    if (command === "m" || command === "l") {
      const dx = readNumber()
      const dy = readNumber()
      if (dx == null || dy == null) {
        return null
      }
      x += dx
      y += dy
      if (command === "m") {
        startX = x
        startY = y
        command = "l"
      }
      points.push({ x, y })
      continue
    }

    if (command === "H") {
      const nextX = readNumber()
      if (nextX == null) {
        return null
      }
      x = nextX
      points.push({ x, y })
      continue
    }

    if (command === "h") {
      const dx = readNumber()
      if (dx == null) {
        return null
      }
      x += dx
      points.push({ x, y })
      continue
    }

    if (command === "V") {
      const nextY = readNumber()
      if (nextY == null) {
        return null
      }
      y = nextY
      points.push({ x, y })
      continue
    }

    if (command === "v") {
      const dy = readNumber()
      if (dy == null) {
        return null
      }
      y += dy
      points.push({ x, y })
      continue
    }

    return null
  }

  return points
}

function coverageRatio(box: RectBox, viewBox: ViewBox): number {
  const viewArea = viewBox.width * viewBox.height
  if (viewArea <= 0) {
    return 0
  }

  const left = Math.max(box.x, viewBox.minX)
  const top = Math.max(box.y, viewBox.minY)
  const right = Math.min(box.x + box.width, viewBox.minX + viewBox.width)
  const bottom = Math.min(box.y + box.height, viewBox.minY + viewBox.height)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  return (width * height) / viewArea
}

function readSolidFill(element: Element): string | null {
  if (isTransparent(element.getAttribute("opacity"))) {
    return null
  }

  if (isTransparent(element.getAttribute("fill-opacity"))) {
    return null
  }

  const styleFill = readStyleFill(element.getAttribute("style"))
  const fill = styleFill ?? element.getAttribute("fill")
  if (!fill) {
    return null
  }

  const normalized = fill.trim()
  if (
    normalized.length === 0 ||
    normalized.toLowerCase() === "none" ||
    normalized.toLowerCase() === "transparent" ||
    normalized.toLowerCase() === "currentcolor" ||
    normalized.toLowerCase().startsWith("url(")
  ) {
    return null
  }

  return parseCssColor(normalized) ? normalized : null
}

function readStyleFill(style: string | null): string | null {
  if (!style) {
    return null
  }

  const match = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)
  return match?.[1]?.trim() ?? null
}

function isTransparent(raw: string | null): boolean {
  if (raw == null || raw.trim().length === 0) {
    return false
  }

  const value = Number(raw)
  return Number.isFinite(value) && value <= 0.05
}

function parseUserCoord(
  raw: string | null,
  origin: number,
  span: number,
): number | null {
  if (raw == null || raw.trim().length === 0) {
    return null
  }

  if (raw.trim().endsWith("%")) {
    const percent = parseLength(raw, span)
    return percent == null ? null : origin + percent
  }

  return parseLength(raw)
}

function parseLength(raw: string | null, percentOf?: number): number | null {
  if (raw == null || raw.trim().length === 0) {
    return null
  }

  const value = raw.trim()
  if (value.endsWith("%")) {
    if (percentOf == null) {
      return null
    }
    const percent = Number(value.slice(0, -1))
    return Number.isFinite(percent) ? (percent / 100) * percentOf : null
  }

  const numeric = Number.parseFloat(value)
  return Number.isFinite(numeric) ? numeric : null
}

function parseCssColor(
  raw: string,
): { r: number; g: number; b: number } | null {
  const value = raw.trim().toLowerCase()
  const named = NAMED_COLORS[value]
  if (named) {
    return parseHexColor(named)
  }

  if (value.startsWith("#")) {
    return parseHexColor(value)
  }

  const rgb = value.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/,
  )
  if (rgb) {
    const alpha = rgb[4] == null ? 1 : Number(rgb[4])
    if (!Number.isFinite(alpha) || alpha <= 0.05) {
      return null
    }
    return {
      r: clampChannel(Number(rgb[1])),
      g: clampChannel(Number(rgb[2])),
      b: clampChannel(Number(rgb[3])),
    }
  }

  return null
}

function parseHexColor(raw: string): { r: number; g: number; b: number } | null {
  const hex = raw.replace("#", "")
  if (hex.length === 3 || hex.length === 4) {
    const r = Number.parseInt(hex[0]! + hex[0], 16)
    const g = Number.parseInt(hex[1]! + hex[1], 16)
    const b = Number.parseInt(hex[2]! + hex[2], 16)
    const a = hex.length === 4 ? Number.parseInt(hex[3]! + hex[3], 16) / 255 : 1
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || a <= 0.05) {
      return null
    }
    return { r, g, b }
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || a <= 0.05) {
      return null
    }
    return { r, g, b }
  }

  return null
}

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(255, value))
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (channel: number) => {
    const scaled = channel / 255
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4
  }

  return (
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  )
}
