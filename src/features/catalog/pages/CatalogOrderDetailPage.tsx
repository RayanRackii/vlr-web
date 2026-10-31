import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { STAFF_ORDER_STATUS_TONE } from "../lib/catalogStatusBadge"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { CatalogTabs } from "@/features/catalog/components/StaffCatalogChrome"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageHeader } from "@/components/layout/PageHeader"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { formatOrderTotalText } from "@/features/catalog/lib/catalogPriceSummary"
import { Can } from "@/features/users/permissions/Can"
import {
  B2B_ORDER_ACTIONS,
  catalogReasonFormSchema,
  formatCatalogDate,
  formatCatalogMoney,
  type B2BOrderAction,
  type CatalogOrder,
  type CatalogReasonFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  approveCatalogOrder,
  cancelCatalogOrder,
  completeCatalogOrder,
  getCatalogOrder,
  listCatalogProducts,
  markCatalogOrderReady,
  rejectCatalogOrder,
  startPreparingCatalogOrder,
} from "@/features/catalog/services/catalogService"


export function CatalogOrderDetailPage() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const navigate = useNavigate()
  const params = useParams()
  const orderId = params.orderId ?? ""

  const [order, setOrder] = useState<CatalogOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<B2BOrderAction | null>(null)
  const [reasonAction, setReasonAction] = useState<"reject" | "cancel" | null>(
    null,
  )
  const [inactiveProductNames, setInactiveProductNames] = useState<string[]>([])
  const [inactiveForOrderId, setInactiveForOrderId] = useState<string | null>(
    null,
  )

  const form = useForm<CatalogReasonFormValues>({
    resolver: zodResolver(catalogReasonFormSchema),
    defaultValues: { reason: "" },
  })
  const reasonValues = useWatch({ control: form.control })

  async function load() {
    if (!orderId) {
      setLoadError(t("apiErrors.loadCatalogOrder"))
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await getCatalogOrder(orderId)
      setOrder(data)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t("apiErrors.loadCatalogOrder"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when id changes
  }, [orderId])

  useEffect(() => {
    if (!order || !B2B_ORDER_ACTIONS[order.status].includes("approve")) {
      return
    }

    const orderIdForLookup = order.id
    let cancelled = false
    void listCatalogProducts()
      .then((products) => {
        if (cancelled) {
          return
        }
        const inactiveIds = new Set(
          products
            .filter((product) => !product.isActive)
            .map((product) => product.id),
        )
        setInactiveForOrderId(orderIdForLookup)
        setInactiveProductNames(
          order.items
            .filter((item) => inactiveIds.has(item.productId))
            .map((item) => item.productName),
        )
      })
      .catch((error: unknown) => {
        console.error("CatalogOrderDetailPage inactive products failed", error)
      })

    return () => {
      cancelled = true
    }
  }, [order])

  const inactiveNamesForApproval =
    order != null &&
    inactiveForOrderId === order.id &&
    B2B_ORDER_ACTIONS[order.status].includes("approve")
      ? inactiveProductNames
      : []

  async function runAction(action: Exclude<B2BOrderAction, "reject" | "cancel">) {
    if (!order) {
      return
    }
    setBusyAction(action)
    try {
      const next =
        action === "approve"
          ? await approveCatalogOrder(order.id)
          : action === "preparing"
            ? await startPreparingCatalogOrder(order.id)
            : action === "ready"
              ? await markCatalogOrderReady(order.id)
              : await completeCatalogOrder(order.id)
      setOrder(next)
      toast.success(t("catalog.orders.toastUpdated"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.transitionCatalogOrder"),
      )
    } finally {
      setBusyAction(null)
    }
  }

  async function submitReason(values: CatalogReasonFormValues) {
    if (!order || reasonAction == null) {
      return
    }
    setBusyAction(reasonAction)
    try {
      const next =
        reasonAction === "reject"
          ? await rejectCatalogOrder(order.id, values.reason)
          : await cancelCatalogOrder(order.id, values.reason)
      setOrder(next)
      setReasonAction(null)
      form.reset({ reason: "" })
      toast.success(t("catalog.orders.toastUpdated"))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("apiErrors.transitionCatalogOrder")
      toast.error(/^Invalid input\b/i.test(message) ? t("catalog.orders.reason.empty") : message)
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) {
    return <PageContentSkeleton rows={5} />
  }

  if (loadError || !order) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {loadError ?? t("apiErrors.loadCatalogOrder")}
          </AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={() => void load()}>
          {t("catalog.retry")}
        </Button>
      </div>
    )
  }

  const actions = B2B_ORDER_ACTIONS[order.status]
  const totalLabel = formatOrderTotalText(order, i18n.language, {
    onRequest: t("catalog.priceOnRequest"),
    partial: (amount) => t("catalog.knownPlusOnRequest", { amount }),
  })

  return (
    <div className="staff-catalog staff-catalog-detail space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="touch-target min-h-11 px-3"
        onClick={() => { void navigate("/catalogo/pedidos") }}
      >
        {t("common.back")}
      </Button>
      <PageHeader
        className="min-w-0 [&_h1]:tabular-nums"
        title={order.displayNumber}
        description={<>{order.customerName}{order.customerEmail ? ` · ${order.customerEmail}` : ""}</>}
        actions={<span className="staff-catalog-status" data-tone={STAFF_ORDER_STATUS_TONE[order.status]}>
          {t(`catalog.status.${order.status}`)}
        </span>}
      />

      <CatalogTabs active="orders" />

      {inactiveNamesForApproval.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>{t("catalog.orders.inactiveProductWarningTitle")}</AlertTitle>
          <AlertDescription>
            {t("catalog.orders.inactiveProductWarning", {
              names: inactiveNamesForApproval.join(", "),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <Can permission="catalog.orders.manage">
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.includes("approve") ? (
              <LoadingButton
                type="button"
                className="touch-target"
                loading={busyAction === "approve"}
                onClick={() => {
                  void runAction("approve")
                }}
              >
                {t("catalog.orders.actions.approve")}
              </LoadingButton>
            ) : null}
            {actions.includes("preparing") ? (
              <LoadingButton
                type="button"
                className="touch-target"
                loading={busyAction === "preparing"}
                onClick={() => {
                  void runAction("preparing")
                }}
              >
                {t("catalog.orders.actions.preparing")}
              </LoadingButton>
            ) : null}
            {actions.includes("ready") ? (
              <LoadingButton
                type="button"
                className="touch-target"
                loading={busyAction === "ready"}
                onClick={() => {
                  void runAction("ready")
                }}
              >
                {t("catalog.orders.actions.ready")}
              </LoadingButton>
            ) : null}
            {actions.includes("complete") ? (
              <LoadingButton
                type="button"
                className="touch-target"
                loading={busyAction === "complete"}
                onClick={() => {
                  void runAction("complete")
                }}
              >
                {t("catalog.orders.actions.complete")}
              </LoadingButton>
            ) : null}
            {actions.includes("reject") ? (
              <Button
                type="button"
                className="touch-target"
                variant="outline"
                onClick={() => {
                  form.reset({ reason: "" })
                  setReasonAction("reject")
                }}
              >
                {t("catalog.orders.actions.reject")}
              </Button>
            ) : null}
            {actions.includes("cancel") ? (
              <Button
                type="button"
                className="touch-target"
                variant="outline"
                onClick={() => {
                  form.reset({ reason: "" })
                  setReasonAction("cancel")
                }}
              >
                {t("catalog.orders.actions.cancel")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </Can>

      <section className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-4 sm:p-6">
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">
            {t("catalog.orders.total")}:{" "}
          </span>
          {totalLabel}
        </p>
        {order.customerNote ? (
          <p className="text-sm">
            <span className="text-muted-foreground">
              {t("catalog.orders.customerNote")}:{" "}
            </span>
            {order.customerNote}
          </p>
        ) : null}
        {order.rejectedReason ? (
          <p className="text-sm">
            <span className="text-muted-foreground">
              {t("catalog.orders.rejectedReason")}:{" "}
            </span>
            {order.rejectedReason}
          </p>
        ) : null}
        {order.cancelledReason ? (
          <p className="text-sm">
            <span className="text-muted-foreground">
              {t("catalog.orders.cancelledReason")}:{" "}
            </span>
            {order.cancelledReason}
          </p>
        ) : null}
      </section>

      <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("catalog.orders.items")}</h2>
        <ul className="min-w-0 divide-y divide-border">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3 text-sm tabular-nums"
            >
              <span className="min-w-0 break-words">
                {item.productName}
                {item.productCode ? ` (${item.productCode})` : ""} ×{" "}
                {item.quantity}
              </span>
              <span>
                {formatCatalogMoney(
                  item.subTotal,
                  item.currency,
                  i18n.language,
                ) ?? t("catalog.priceOnRequest")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("catalog.orders.timeline")}</h2>
        <ol className="space-y-2">
          {order.history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              <p className="font-medium">
                {t(`catalog.status.${entry.status}`)}
              </p>
              <p className="tabular-nums text-muted-foreground">
                {t(`catalog.actor.${entry.actorType}`)} ·{" "}
                {formatCatalogDate(entry.createdAt, i18n.language, timeZoneId)}
              </p>
              {entry.reason ? (
                <p className="mt-1 text-muted-foreground">{entry.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <Dialog
        open={reasonAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReasonAction(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonAction === "reject"
                ? t("catalog.orders.reason.rejectTitle")
                : t("catalog.orders.reason.cancelTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.orders.reason.required")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(submitReason)}
              noValidate
            >
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("catalog.orders.reason.label")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReasonAction(null)
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <FormPrimaryButton
                  isValid={catalogReasonFormSchema.safeParse(reasonValues).success}
                  type="submit"
                  loading={busyAction === "reject" || busyAction === "cancel"}
                  loadingLabel={t("catalog.orders.saving")}
                >
                  {t("catalog.orders.reason.confirm")}
                </FormPrimaryButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
