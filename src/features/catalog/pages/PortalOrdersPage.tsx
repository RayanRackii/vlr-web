import "../components/portalOrders.css"

import { useEffect, useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { ArrowRight, ShoppingBag } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { PortalStatusChip } from "@/features/catalog/components/PortalStatusChip"
import { formatOrderTotalText } from "@/features/catalog/lib/catalogPriceSummary"
import {
  formatCatalogDate,
  type CatalogOrder,
} from "@/features/catalog/schemas/catalogSchemas"
import { listPortalCatalogOrders } from "@/features/catalog/services/catalogPortalService"
import { catalogOrderStatusTone } from "@/features/catalog/lib/catalogStatusBadge"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

export function PortalOrdersPage() {
  const { t, i18n } = useTranslation()
  const { subdomain, branding } = useOutletContext<CustomerAppOutletContext>()
  const [orders, setOrders] = useState<CatalogOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void listPortalCatalogOrders()
      .then((data) => {
        if (!cancelled) {
          setOrders(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : t("apiErrors.loadPortalOrders"),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [t, reloadKey, subdomain])

  useEffect(() => {
    // Throttle focus refreshes so repeated focus events cannot pile up list requests.
    let lastRefreshAt = 0
    const refreshVisible = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastRefreshAt < 5000) return
      lastRefreshAt = now
      setReloadKey((value) => value + 1)
    }
    window.addEventListener("focus", refreshVisible)
    return () => window.removeEventListener("focus", refreshVisible)
  }, [])

  return (
    <div className="portal-records">
      <header className="portal-booking-header portal-records-header">
        <p className="portal-eyebrow break-words">{branding.displayName}</p>
        <h1>{t("tenantPortal.catalog.ordersTitle")}</h1>
        <p className="text-muted-foreground">
          {t("tenantPortal.catalog.ordersSubtitle")}
        </p>
      </header>

      {loading ? (
        <ul
          className="portal-records-list"
          role="status"
          aria-busy="true"
          aria-label={t("tenantPortal.catalog.ordersLoading")}
        >
          {[0, 1, 2].map((index) => (
            <li key={index} className="portal-record-card">
              <Skeleton className="size-[46px] shrink-0 rounded-full" aria-hidden />
              <div className="portal-record-body">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      ) : loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p className="min-w-0">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setLoading(true)
              setReloadKey((value) => value + 1)
            }}
          >
            {t("catalog.retry")}
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="portal-empty" role="status">
          <div className="portal-empty-icon">
            <ShoppingBag strokeWidth={1.75} aria-hidden />
          </div>
          <h2>{t("tenantPortal.catalog.ordersEmpty")}</h2>
          <p>
            {t("tenantPortal.catalog.ordersEmptyDescription", {
              tenant: branding.displayName,
            })}
          </p>
          <Button
            type="button"
            className="portal-catalog-button portal-catalog-primary mt-2"
            render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
          >
            <ShoppingBag aria-hidden data-icon="inline-start" />
            {t("tenantPortal.catalog.requestSentCatalog")}
          </Button>
        </div>
      ) : (
        <ul className="portal-records-list">
          {orders.map((order) => {
            const totalLabel = formatOrderTotalText(order, i18n.language, {
              onRequest: t("catalog.priceOnRequest"),
              partial: (amount) => t("catalog.knownPlusOnRequest", { amount }),
            })
            const itemCount = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            )
            return (
              <li key={order.id}>
                <Link
                  className="portal-record-card"
                  to={tenantPortalPath(subdomain, `pedidos/${order.id}`)}
                >
                  <span className="portal-record-icon" aria-hidden>
                    <ShoppingBag strokeWidth={1.75} />
                  </span>
                  <span className="portal-record-body">
                    <span className="portal-record-top">
                      <span className="portal-record-title">
                        {order.displayNumber}
                      </span>
                      <PortalStatusChip tone={catalogOrderStatusTone(order.status)}>
                        {t(`catalog.status.${order.status}`)}
                      </PortalStatusChip>
                    </span>
                    <span className="portal-record-meta">
                      {formatCatalogDate(order.createdAt, i18n.language)}
                      {" · "}
                      {t("tenantPortal.catalog.itemCount", { count: itemCount })}
                    </span>
                    <span className="portal-record-foot">
                      <span className="portal-record-total">{totalLabel}</span>
                      <span className="portal-record-view">
                        {t("catalog.orders.view")}
                        <ArrowRight aria-hidden />
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
