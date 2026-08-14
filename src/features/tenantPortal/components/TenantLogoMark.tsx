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
}: TenantLogoMarkProps) {
  const safeSvg = sanitizeTenantLogoSvg(logoSvg)
  const primary = primaryColor ?? ROLVIX_PRIMARY_COLOR

  if (safeSvg) {
    return (
      <div
        className={cn(
          "mx-auto flex items-center justify-center text-foreground",
          // Force inlined SVG to fill the box (works with backend width/height=100%).
          "[&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full",
          size === "lg" ? "h-28 w-28 max-w-[240px] sm:h-32 sm:w-32" : "size-8 max-w-8",
          className,
        )}
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
      style={{ backgroundColor: primary }}
      aria-hidden="true"
    >
      {initials(displayName)}
    </div>
  )
}
