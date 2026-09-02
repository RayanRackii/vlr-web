import type { TenantLogoBackgroundInspection } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"

export type TenantLogoRenderMode = "auto" | "original" | "adaptive-surface"
export type TenantLogoSurface = "none" | "light" | "neutral"
export type TenantLogoTheme = "light" | "dark"

export function resolveTenantLogoSurface(options: {
  theme: TenantLogoTheme | undefined
  inspection: TenantLogoBackgroundInspection
  renderMode?: TenantLogoRenderMode
}): TenantLogoSurface {
  const renderMode = options.renderMode ?? "auto"

  if (renderMode === "original") {
    return "none"
  }

  if (!options.inspection.hasEmbeddedBackground) {
    return "none"
  }

  const forceAdaptive = renderMode === "adaptive-surface"
  const theme = options.theme

  if (options.inspection.backgroundIsDark) {
    if (forceAdaptive || theme === "dark") {
      return "light"
    }
    return "none"
  }

  if (options.inspection.backgroundIsLight) {
    if (forceAdaptive || theme === "light") {
      return "neutral"
    }
    return "none"
  }

  return "none"
}
