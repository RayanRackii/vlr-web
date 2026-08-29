import { useEffect, useState } from "react"
import { Link, useOutletContext, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
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
  const [cancelling, setCancelling] = useState(false)

  async function load() {
    if (!orderId) {
      setLoadError(t("apiErrors.loadPortalOrder"))
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getPortalCatalogOrder(orderId)
      setOrder(data)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t("apiErrors.loadPortalOrder"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [orderId])

  async function onCancel() {
    if (!order) {
      return
    }
    setCancelling(true)
    try {
      const next = await cancelPortalCatalogOrder(order.id)
      setOrder(next)
      toast.success(t("tenantPortal.catalog.orderCancelled"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.cancelPortalOrder"),
      )
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return <PageContentSkeleton rows={4} />
  }

  if (loadError || !order) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">
          {loadError ?? t("apiErrors.loadPortalOrder")}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void load()
          }}
        >
          {t("catalog.retry")}
        </Button>
      </div>
    )
  }

  const totalLabel =
    formatCatalogMoney(order.totalAmount, order.currency, i18n.language) ??
    t("catalog.priceOnRequest")

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        render={<Link to={tenantPortalPath(subdomain, "pedidos")} />}
      >
        {t("common.back")}
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {order.displayNumber}
          </h1>
          <p className="text-sm text-muted-foreground">{totalLabel}</p>
        </div>
        <Badge variant="outline">{t(`catalog.status.${order.status}`)}</Badge>
      </div>

      {order.status === "Requested" ? (
        <LoadingButton
          type="button"
          variant="outline"
          loading={cancelling}
          loadingLabel={t("tenantPortal.catalog.cancelling")}
          onClick={() => {
            void onCancel()
          }}
        >
          {t("tenantPortal.catalog.cancelOrder")}
        </LoadingButton>
      ) : null}

      {order.customerNote ? (
        <p className="text-sm text-muted-foreground">
          {t("catalog.orders.customerNote")}: {order.customerNote}
        </p>
      ) : null}

      <ul className="divide-y rounded-xl border border-border">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <span>
              {item.productName} × {item.quantity}
            </span>
            <span>
              {formatCatalogMoney(item.subTotal, item.currency, i18n.language) ??
                t("catalog.priceOnRequest")}
            </span>
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">{t("catalog.orders.timeline")}</h2>
        <ol className="space-y-2">
          {order.history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              <p className="font-medium">{t(`catalog.status.${entry.status}`)}</p>
              <p className="text-muted-foreground">
                {formatCatalogDate(entry.createdAt, i18n.language)}
              </p>
              {entry.reason ? (
                <p className="mt-1 text-muted-foreground">{entry.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
