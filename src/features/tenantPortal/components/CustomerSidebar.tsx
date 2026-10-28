import { CalendarDays, Package, ShoppingBag, type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { customerNavHref } from "@/features/catalog/customerNav"
import { isCustomerNavItemActive } from "@/features/catalog/customerNavActive"
import { TenantLogoMark } from "@/features/tenantPortal/components/TenantLogoMark"
import { getEmailInitials } from "@/components/layout/navigation"
import { cn } from "@/lib/utils"

export type CustomerNavItem = {
  id: string
  label: string
  to: string
  icon: LucideIcon
  /** Match only the exact path (no descendant routes). */
  end?: boolean
}

type CustomerSidebarProps = {
  brandLabel: string
  logoSvg?: string | null
  primaryColor?: string | null
  items: readonly CustomerNavItem[]
  onNavigate?: () => void
  className?: string
  userLabel?: string | null
}

export function CustomerSidebar({
  brandLabel,
  logoSvg,
  primaryColor,
  items,
  onNavigate,
  className,
  userLabel,
}: CustomerSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div className={cn("portal-sidebar flex h-full flex-col", className)}>
      <div className="portal-brand">
        <div className="portal-brand-tile"><TenantLogoMark logoSvg={logoSvg} displayName={brandLabel} primaryColor={primaryColor} size="sm" className="mx-0 shrink-0" /></div>
        <div className="min-w-0"><span className="block truncate text-sm font-semibold" title={brandLabel}>{brandLabel}</span><small>{t("tenantPortal.redesign.customerPortal")}</small></div>
      </div>
      <nav className="portal-nav" aria-label={t("nav.menu")}>
        <p className="portal-nav-heading">{t("tenantPortal.redesign.navigation")}</p>
        {items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {t("tenantPortal.menu.empty")}
          </p>
        ) : (
          items.map((item) => {
            const Icon = item.icon
            const active = isCustomerNavItemActive(
              item,
              items,
              location.pathname,
              location.hash,
            )
            const href = customerNavHref(item.to, location.pathname, location.search)
            const hashIndex = href.indexOf("#")
            const hrefHash = hashIndex < 0 ? "" : href.slice(hashIndex)
            const hrefBase = hashIndex < 0 ? href : href.slice(0, hashIndex)
            return (
              <Link
                key={item.id}
                to={href}
                onClick={() => {
                  // Link navigation is a no-op when the hash is already set, so the
                  // target section's own scroll effect never re-fires — scroll it here.
                  if (
                    hrefHash.length > 0 &&
                    hrefHash === location.hash &&
                    hrefBase === `${location.pathname}${location.search}`
                  ) {
                    document
                      .getElementById(hrefHash.slice(1))
                      ?.scrollIntoView({ block: "start" })
                  }
                  onNavigate?.()
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "portal-nav-link", item.id === "customer-profile" && "portal-profile-link",
                )}
              >
                <Icon strokeWidth={1.75} className="size-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })
        )}
      </nav>
      {userLabel ? <div className="portal-user-chip"><span className="portal-avatar" aria-hidden="true">{getEmailInitials(userLabel)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold" title={userLabel}>{userLabel}</p><p className="text-xs text-muted-foreground">{t("tenantPortal.redesign.customer")}</p></div></div> : null}
    </div>
  )
}

/** Icon for a platform module key (B2C surfaces). */
export function iconForModule(moduleName: string): LucideIcon {
  switch (moduleName.toLowerCase()) {
    case "rentals":
      return CalendarDays
    case "catalog":
    case "catalogo":
    case "catálogo":
    case "orders":
    case "pedidos":
      return ShoppingBag
    default:
      return Package
  }
}
