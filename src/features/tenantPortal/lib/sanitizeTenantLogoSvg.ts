import DOMPurify from "dompurify"
import type { Config } from "dompurify"

const SVG_PROFILE: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ["use"],
}

/** Sanitize tenant brand SVG for safe inline render. */
export function sanitizeTenantLogoSvg(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim().length === 0) {
    return null
  }

  const cleaned = DOMPurify.sanitize(raw.trim(), SVG_PROFILE)
  if (!cleaned.toLowerCase().includes("<svg")) {
    return null
  }

  return cleaned
}
