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

  if (renderMode === "original" || renderMode === "auto") {
    return "none"
  }

  if (!options.inspection.hasEmbeddedBackground) {
    return "none"
  }

  if (options.inspection.backgroundIsDark) {
    return "light"
  }

  if (options.inspection.backgroundIsLight) {
    return "neutral"
  }

  return "none"
}
