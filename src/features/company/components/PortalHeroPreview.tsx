import { useTranslation } from "react-i18next"

import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import { cn } from "@/lib/utils"

type PortalHeroPreviewProps = {
  imageUrl: string | null
  displayName: string
  logoSvg?: string | null
  primaryColor?: string | null
  kicker: string
  headline: string
  subtitle: string
  /** Subtitle shown when the company left its own blank. */
  fallbackSubtitle: string
  className?: string
}

/**
 * Scaled-down preview of the customer portal login hero (image with a dark gradient, logo and name,
 * kicker, headline and subtitle). Text sizes follow the card width through container units, so it
 * stays proportional at any viewport.
 * TODO: switch to the shared PortalAuthLayout hero once feat/portal-auth-layout is on develop.
 */
export function PortalHeroPreview({
  imageUrl,
  displayName,
  logoSvg,
  primaryColor,
  kicker,
  headline,
  subtitle,
  fallbackSubtitle,
  className,
}: PortalHeroPreviewProps) {
  const { t } = useTranslation()
  const shownKicker = kicker.trim()
  const shownHeadline = headline.trim() || displayName
  const shownSubtitle = subtitle.trim() || fallbackSubtitle

  return (
    <div
      data-testid="portal-hero-preview"
      role="img"
      aria-label={t("portalAppearance.preview.label")}
      className={cn("relative isolate aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-neutral-900 text-white", className)}
      style={{ containerType: "inline-size", ...(imageUrl ? {} : { backgroundColor: primaryColor ?? undefined }) }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 -z-20 size-full object-cover" data-testid="portal-hero-preview-image" />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/20" aria-hidden="true" />

      <div className="flex items-center gap-[2.5cqw] p-[4cqw]">
        <div className="size-[9cqw] min-h-6 min-w-6 shrink-0 overflow-hidden rounded-[1.5cqw] bg-white/90 p-[0.8cqw]">
          <TenantLogoMark logoSvg={logoSvg} displayName={displayName} primaryColor={primaryColor} size="sm" className="size-full max-w-none" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight" style={{ fontSize: "max(10px, 3.4cqw)" }}>{displayName}</p>
          <p className="truncate text-white/70" style={{ fontSize: "max(8px, 2.4cqw)" }}>{t("portalAppearance.preview.customerPortal")}</p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 space-y-[1.2cqw] p-[5cqw]">
        {shownKicker ? (
          <p className="truncate font-semibold uppercase tracking-widest text-amber-300" style={{ fontSize: "max(8px, 2.2cqw)" }} data-testid="portal-hero-preview-kicker">{shownKicker}</p>
        ) : null}
        <p className="line-clamp-3 break-words font-bold leading-tight" style={{ fontSize: "max(14px, 6cqw)" }} data-testid="portal-hero-preview-headline">{shownHeadline}</p>
        <p className="line-clamp-3 break-words text-white/80" style={{ fontSize: "max(9px, 2.8cqw)" }} data-testid="portal-hero-preview-subtitle">{shownSubtitle}</p>
      </div>
    </div>
  )
}
