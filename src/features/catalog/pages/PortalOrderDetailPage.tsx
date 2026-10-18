import { useEffect, useRef, useState } from "react"
import { Link, useOutletContext, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { formatOrderTotalText } from "@/features/catalog/lib/catalogPriceSummary"
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
  const [confirmCancel, setConfirmCancel] = useState(false)
  const cancellingRef = useRef(false)

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
    if (!order || cancellingRef.current) {
      return
    }
    cancellingRef.current = true
    setCancelling(true)
    try {
      const next = await cancelPortalCatalogOrder(order.id)
      setOrder(next)
      setConfirmCancel(false)
      toast.success(t("tenantPortal.catalog.orderCancelled"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.cancelPortalOrder"),
      )
    } finally {
      cancellingRef.current = false
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

  const totalLabel = formatOrderTotalText(order, i18n.language, {
    onRequest: t("catalog.priceOnRequest"),
    partial: (amount) => t("catalog.knownPlusOnRequest", { amount }),
  })

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
            setConfirmCancel(true)
          }}
        >
          {t("tenantPortal.catalog.cancelOrder")}
        </LoadingButton>
      ) : null}

      <AlertDialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setConfirmCancel(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("tenantPortal.catalog.cancelConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tenantPortal.catalog.cancelConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              {t("tenantPortal.catalog.cancelConfirmDismiss")}
            </AlertDialogCancel>
            <LoadingButton
              type="button"
              variant="destructive"
              loading={cancelling}
              loadingLabel={t("tenantPortal.catalog.cancelling")}
              onClick={() => {
                void onCancel()
              }}
            >
              {t("tenantPortal.catalog.cancelConfirmAction")}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
