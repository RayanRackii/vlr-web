import { sanitizeTenantLogoSvg } from "@/features/tenantPortal/lib/sanitizeTenantLogoSvg"
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
  const primary = primaryColor ?? "#0F766E"

  if (safeSvg) {
    return (
      <div
        className={cn(
          "mx-auto flex items-center justify-center text-foreground [&_svg]:h-full [&_svg]:w-auto [&_svg]:max-w-full",
          size === "lg" ? "h-20 max-w-[220px]" : "size-7 max-w-7",
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
        size === "lg" ? "h-16 w-16 text-lg" : "size-7 text-[10px]",
        className,
      )}
      style={{ backgroundColor: primary }}
      aria-hidden="true"
    >
      {initials(displayName)}
    </div>
  )
}
