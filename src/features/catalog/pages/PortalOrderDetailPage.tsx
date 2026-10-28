import "../components/portalOrders.css"

import { useEffect, useState } from "react"
import { Link, useOutletContext, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { PortalCancelAction } from "@/features/catalog/components/PortalCancelAction"
import { PortalStatusChip } from "@/features/catalog/components/PortalStatusChip"
import { formatOrderTotalText } from "@/features/catalog/lib/catalogPriceSummary"
import { catalogOrderStatusTone } from "@/features/catalog/lib/catalogStatusBadge"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  formatCatalogDate,
  formatCatalogMoney,
  type CatalogOrder,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  cancelPortalCatalogOrder,
  getPortalCatalogOrder,
} from "@/features/catalog/services/catalogPortalService"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

export function PortalOrderDetailPage() {
  const { t, i18n } = useTranslation()
  const params = useParams()
  const { subdomain } = useOutletContext<CustomerAppOutletContext>()
  const orderId = params.orderId ?? ""

  const [order, setOrder] = useState<CatalogOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const identity = `${subdomain}:${orderId}`
  const [seenIdentity, setSeenIdentity] = useState(identity)
  if (seenIdentity !== identity) {
    setSeenIdentity(identity)
    setOrder(null)
    setLoading(true)
    setLoadError(null)
  }
  useEffect(() => {
    let stale = false
    setLoading(true)
    setLoadError(null)
    if (!orderId) {
      setLoadError(t("apiErrors.loadPortalOrder"))
      setLoading(false)
      return
    }
    void getPortalCatalogOrder(orderId).then((data) => {
      if (!stale) setOrder(data)
    }).catch((error: unknown) => {
      if (!stale) setLoadError(error instanceof Error ? error.message : t("apiErrors.loadPortalOrder"))
    }).finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [orderId, subdomain, reload, t])

  const back = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="portal-record-back"
      render={<Link to={tenantPortalPath(subdomain, "pedidos")} />}
    >
      <ArrowLeft aria-hidden data-icon="inline-start" />
      {t("common.back")}
    </Button>
  )

  if (loading) {
    return (
      <div className="portal-record-detail space-y-4">
        {back}
        <PageContentSkeleton rows={4} />
      </div>
    )
  }

  if (loadError || !order) {
    return (
      <div className="portal-record-detail space-y-4">
        {back}
        <div role="alert" className="space-y-4">
          <p className="text-sm text-destructive">
            {loadError ?? t("apiErrors.loadPortalOrder")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setReload((value) => value + 1)
            }}
          >
            {t("catalog.retry")}
          </Button>
        </div>
      </div>
    )
  }

  const totalLabel = formatOrderTotalText(order, i18n.language, {
    onRequest: t("catalog.priceOnRequest"),
    partial: (amount) => t("catalog.knownPlusOnRequest", { amount }),
  })

  return (
    <div className="portal-record-detail space-y-4">
      {back}

      <section className="portal-record-panel space-y-5">
        <div className="portal-record-panel-head">
          <div className="space-y-1">
            <p className="portal-eyebrow">{t("tenantPortal.catalog.navOrders")}</p>
            <h1>{order.displayNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {formatCatalogDate(order.createdAt, i18n.language)}
            </p>
            <p className="text-sm font-medium">{totalLabel}</p>
          </div>
          <PortalStatusChip tone={catalogOrderStatusTone(order.status)}>
            {t(`catalog.status.${order.status}`)}
          </PortalStatusChip>
        </div>

        <PortalCancelAction key={`${subdomain}:${order.id}`} kind="orders" status={order.status} cancel={async () => {
          const next = await cancelPortalCatalogOrder(order.id)
          setOrder((current) => current?.id === next.id ? next : current)
        }} />

        {order.customerNote ? (
          <div className="space-y-1">
            <h2 className="portal-record-section-title">
              {t("catalog.orders.customerNote")}
            </h2>
            <p className="whitespace-pre-wrap break-words text-sm">
              {order.customerNote}
            </p>
          </div>
        ) : null}

        <div>
          <h2 className="portal-record-section-title">
            {t("catalog.orders.items")}
          </h2>
          <ul className="portal-record-lines">
            {order.items.map((item) => (
              <li key={item.id} className="portal-record-line">
                <span className="portal-record-line-name">
                  {item.productName} × {item.quantity}
                </span>
                <span className="portal-record-line-amount">
                  {formatCatalogMoney(item.subTotal, item.currency, i18n.language) ??
                    t("catalog.priceOnRequest")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {order.history.length > 0 ? (
        <section className="portal-record-panel">
          <h2 className="portal-record-section-title">
            {t("catalog.orders.timeline")}
          </h2>
          <ol className="portal-timeline">
            {order.history.map((entry) => (
              <li key={entry.id} className="portal-timeline-entry">
                <span className="portal-timeline-rail" aria-hidden>
                  <span className="portal-timeline-dot" />
                  <span className="portal-timeline-line" />
                </span>
                <div className="portal-timeline-body">
                  <p className="portal-timeline-status">
                    {t(`catalog.status.${entry.status}`)}
                  </p>
                  <p className="portal-timeline-when">
                    {formatCatalogDate(entry.createdAt, i18n.language)}
                  </p>
                  {entry.reason ? (
                    <p className="portal-timeline-reason">{entry.reason}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
