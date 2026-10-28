import "../components/portal/portalHome.css"

import { ArrowRight, LayoutGridIcon, Lightbulb, ListChecks } from "lucide-react"
import { Link, useOutletContext } from "react-router-dom"
import { useTranslation } from "react-i18next"

import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import type { CustomerNavItem } from "@/features/tenantPortal/components/CustomerSidebar"
import { buildCustomerShellNavItems } from "@/features/catalog/customerNav"
import { customerDisplayName } from "@/features/tenantPortal/lib/customerDisplayName"
import { getCustomerLabel } from "@/features/tenantPortal/services/tenantPortalService"

const MY_RESERVATIONS_ID = "customer-my-reservations"
const PROFILE_ID = "customer-profile"

/** Short description shown under each quick-action tile (null hides the tile). */
function tileDescriptionKey(item: CustomerNavItem): string | null {
  if (item.id === PROFILE_ID) {
    return null
  }
  if (item.id === MY_RESERVATIONS_ID) {
    return "tenantPortal.home.descReservations"
  }
  if (item.id.endsWith("-catalog")) {
    return "tenantPortal.home.descCatalog"
  }
  if (item.id.endsWith("-orders")) {
    return "tenantPortal.home.descOrders"
  }
  if (item.id.endsWith("-requests")) {
    return "tenantPortal.home.descRequests"
  }
  return "tenantPortal.home.descReservar"
}

/** Signed-in customer landing: greeting, hero CTA and quick-action tiles. */
export function TenantPortalHomePage() {
  const { t } = useTranslation()
  const { subdomain, branding, menu } =
    useOutletContext<CustomerAppOutletContext>()

  const name = customerDisplayName(getCustomerLabel()).split(/\s+/)[0]
  const navItems = buildCustomerShellNavItems(subdomain, menu, t)
  const tiles = navItems
    .map((item) => ({ item, descriptionKey: tileDescriptionKey(item) }))
    .filter(
      (tile): tile is { item: CustomerNavItem; descriptionKey: string } =>
        tile.descriptionKey !== null,
    )

  const greeting = name
    ? t("tenantPortal.redesign.greetingName", { name })
    : t("tenantPortal.redesign.greeting")

  if (tiles.length === 0) {
    return (
      <div className="portal-home">
        <header className="portal-booking-header portal-home-header">
          <p className="portal-eyebrow break-words">{greeting}</p>
          <h1>{t("tenantPortal.home.title")}</h1>
          <p className="text-muted-foreground">
            {t("tenantPortal.home.emptySubtitle", {
              tenant: branding.displayName,
            })}
          </p>
        </header>
        <div className="portal-empty" role="status">
          <div className="portal-empty-icon">
            <LayoutGridIcon strokeWidth={1.75} aria-hidden />
          </div>
          <h2>{t("tenantPortal.menu.emptyTitle")}</h2>
          <p>
            {t("tenantPortal.home.emptyDescription", {
              tenant: branding.displayName,
            })}
          </p>
        </div>
      </div>
    )
  }

  const reservarTile = tiles.find(
    (tile) => tile.descriptionKey === "tenantPortal.home.descReservar",
  )
  const primary = reservarTile ?? tiles[0]
  const PrimaryIcon = primary.item.icon
  const reservations = tiles.find(
    (tile) => tile.item.id === MY_RESERVATIONS_ID,
  )
  const showSecondary = reservations && reservations.item.id !== primary.item.id
  const heroSubtitleKey = reservarTile
    ? "tenantPortal.home.heroSubtitle"
    : "tenantPortal.home.heroSubtitleCatalog"

  return (
    <div className="portal-home">
      <header className="portal-booking-header portal-home-header">
        <p className="portal-eyebrow break-words">{greeting}</p>
        <h1>{t("tenantPortal.home.title")}</h1>
        <p className="text-muted-foreground">
          {t("tenantPortal.home.subtitle", { tenant: branding.displayName })}
        </p>
      </header>

      <section className="portal-home-hero" aria-labelledby="portal-home-hero-title">
        <div className="portal-home-hero-body">
          <p className="portal-home-hero-eyebrow">
            {t("tenantPortal.home.heroEyebrow")}
          </p>
          <h2 id="portal-home-hero-title">{t("tenantPortal.home.heroTitle")}</h2>
          <p>{t(heroSubtitleKey, { tenant: branding.displayName })}</p>
        </div>
        <div className="portal-home-hero-cta">
          <Link className="portal-home-hero-primary" to={primary.item.to}>
            <PrimaryIcon aria-hidden />
            {primary.item.label}
          </Link>
          {showSecondary ? (
            <Link
              className="portal-home-hero-secondary"
              to={reservations.item.to}
            >
              <ListChecks aria-hidden />
              {reservations.item.label}
            </Link>
          ) : null}
        </div>
      </section>

      <h2 className="portal-home-section-title" id="portal-home-quick-actions">
        {t("tenantPortal.home.quickActions")}
      </h2>
      <ul className="portal-home-grid" aria-labelledby="portal-home-quick-actions">
        {tiles.map((tile, index) => {
          const Icon = tile.item.icon
          return (
            <li key={tile.item.id}>
              <Link
                className="portal-home-tile"
                to={tile.item.to}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="portal-home-tile-icon" aria-hidden>
                  <Icon strokeWidth={1.75} />
                </span>
                <span className="portal-home-tile-title">
                  {tile.item.label}
                </span>
                <p className="portal-home-tile-desc">{t(tile.descriptionKey)}</p>
                <span className="portal-home-tile-go" aria-hidden>
                  {t("tenantPortal.home.open")}
                  <ArrowRight />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="portal-home-tip">
        <Lightbulb aria-hidden />
        <div>
          <strong>{t("tenantPortal.home.tipTitle")}</strong>
          <br />
          {t("tenantPortal.home.tipText")}
        </div>
      </div>
    </div>
  )
}
