import { CalendarDays, Package, ShoppingBag, type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { customerNavHref } from "@/features/catalog/customerNav"
import { isCustomerNavItemActive } from "@/features/catalog/customerNavActive"
import { PortalCartCount } from "@/features/catalog/components/PortalCartCount"
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
  cartQuantity?: number
  userLabel?: string | null
}

export function CustomerSidebar({
  items, onNavigate, className, cartQuantity = 0,
}: CustomerSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div className={cn("portal-sidebar", className)}>
      <nav className="portal-nav" aria-label={t("nav.menu")}>
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
                aria-label={item.id === "customer-cart" ? t("tenantPortal.catalog.cartCount", { count: cartQuantity }) : undefined}
                aria-current={active ? "page" : undefined}
                className="portal-nav-link"
              >
                <Icon strokeWidth={1.75} className="size-5 shrink-0" aria-hidden="true" />
                <span className="portal-nav-label">{item.label}</span>
                {item.id === "customer-cart" ? <PortalCartCount count={cartQuantity} /> : null}
              </Link>
            )
          })
        )}
      </nav>
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
