import { useMemo } from "react"
import { useTheme } from "next-themes"

import { inspectTenantLogoSvg } from "@/features/tenantPortal/lib/inspectTenantLogoSvg"
import {
  resolveTenantLogoSurface,
  type TenantLogoRenderMode,
} from "@/features/tenantPortal/lib/resolveTenantLogoSurface"
import { sanitizeTenantLogoSvg } from "@/features/tenantPortal/lib/sanitizeTenantLogoSvg"
import { ROLVIX_PRIMARY_COLOR } from "@/lib/brandColors"
import { cn } from "@/lib/utils"

type TenantLogoMarkProps = {
  logoSvg?: string | null
  displayName: string
  primaryColor?: string | null
  className?: string
  /** Larger mark on portal hero vs compact sidebar. */
  size?: "sm" | "lg"
  /** Presentation override. Default auto inspects the SVG and adapts the surface only. */
  renderMode?: TenantLogoRenderMode
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function TenantLogoMark({
  logoSvg,
  displayName,
  primaryColor,
  className,
  size = "lg",
  renderMode = "auto",
}: TenantLogoMarkProps) {
  const { resolvedTheme } = useTheme()
  const safeSvg = sanitizeTenantLogoSvg(logoSvg)
  const primary = primaryColor ?? ROLVIX_PRIMARY_COLOR
  const inspection = useMemo(
    () => inspectTenantLogoSvg(safeSvg),
    [safeSvg],
  )
  const surface = resolveTenantLogoSurface({
    theme: resolvedTheme === "dark" || resolvedTheme === "light"
      ? resolvedTheme
      : undefined,
    inspection,
    renderMode,
  })

  if (safeSvg) {
    return (
      <div
        className={cn(
          "mx-auto flex items-center justify-center text-foreground",
          "[&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full",
          size === "lg" ? "h-28 w-28 max-w-[240px] sm:h-32 sm:w-32" : "size-8 max-w-8",
          surface === "light" &&
            (size === "lg"
              ? "overflow-hidden rounded-xl bg-neutral-100 p-2"
              : "overflow-hidden rounded-md bg-neutral-100 p-0.5"),
          surface === "neutral" &&
            (size === "lg"
              ? "overflow-hidden rounded-xl bg-neutral-300/90 p-2"
              : "overflow-hidden rounded-md bg-neutral-300/90 p-0.5"),
          className,
        )}
        data-logo-surface={surface}
        role="img"
        aria-label={displayName}
        // Sanitized SVG only — see sanitizeTenantLogoSvg.
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
    )
  }

  return (
    <div
      className={cn(
        "mx-auto flex items-center justify-center rounded-xl font-bold text-white",
        size === "lg" ? "h-28 w-28 text-2xl sm:h-32 sm:w-32" : "size-8 text-[10px]",
        className,
      )}
      data-logo-surface="none"
      style={{ backgroundColor: primary }}
      aria-hidden="true"
    >
      {initials(displayName)}
    </div>
  )
}
