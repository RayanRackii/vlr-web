import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { STAFF_ORDER_STATUS_TONE } from "../lib/catalogStatusBadge"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { CatalogTabs } from "@/features/catalog/components/StaffCatalogChrome"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, MoreHorizontal } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
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
import { orderResourceFact, type OrderResourceFact } from "@/features/catalog/lib/orderResourceFact"
import { CatalogOrderAllocationPanel } from "@/features/catalog/components/CatalogOrderAllocationPanel"
import {
  allocationAgendaLink,
  useAllocationUsage,
  type OrderAllocation,
} from "@/features/catalog/lib/orderAllocationUsage"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { resolveTenantTimeZone } from "@/lib/tenantTimeZone"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  B2B_ORDER_ACTIONS,
  catalogReasonFormSchema,
  formatCatalogDate,
  formatCatalogMoney,
  type B2BOrderAction,
  type CatalogOrder,
  type CatalogOrderStatus,
  type CatalogReasonFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  approveCatalogOrder,
  cancelCatalogOrder,
  completeCatalogOrder,
  getCatalogOrder,
  getCatalogProductResourceRequirements,
  listCatalogProducts,
  markCatalogOrderReady,
  rejectCatalogOrder,
  startPreparingCatalogOrder,
} from "@/features/catalog/services/catalogService"
import { describeOrderHistoryEntry } from "@/features/catalog/lib/orderHistoryText"
import { listCatalogResourceNames } from "@/features/catalog/lib/resourceNames"


/** History reason codes that describe a usage milestone rather than a status change. */
const USAGE_HISTORY_LABELS: Record<string, string> = {
  "usage.workFinished": "catalog.orders.history.workFinished",
  "usage.released": "catalog.orders.history.released",
}

const PROGRESS_STEPS = ["Requested", "Approved", "Preparing", "Ready", "Completed"] as const satisfies readonly CatalogOrderStatus[]

/** Steps shown in the progress line; Rejected/Cancelled end it as a terminal state. */
function progressSteps(order: CatalogOrder): { steps: CatalogOrderStatus[]; current: CatalogOrderStatus } {
  const status = order.status
  if (status === "Rejected") {
    return { steps: ["Requested", "Rejected"], current: status }
  }
  if (status === "Cancelled") {
    const reached = order.history
      .map((entry) => (PROGRESS_STEPS as readonly string[]).indexOf(entry.status))
      .reduce((max, index) => Math.max(max, index), 0)
    return { steps: [...PROGRESS_STEPS.slice(0, reached + 1), status], current: status }
  }
  return { steps: [...PROGRESS_STEPS], current: status }
}

function OrderProgress({ order }: { order: CatalogOrder }) {
  const { t } = useTranslation()
  const { steps, current } = progressSteps(order)
  const currentIndex = steps.indexOf(current)
  return (
    <ol
      aria-label={t("catalog.orders.progressLabel")}
      className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
    >
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex
        const done = index < currentIndex
        return (
          <li
            key={step}
            aria-current={isCurrent ? "true" : undefined}
            className="flex min-w-0 items-center gap-2"
          >
            {done ? (
              <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
            ) : null}
            {isCurrent ? (
              <span className="staff-catalog-status" data-tone={STAFF_ORDER_STATUS_TONE[step]}>
                {t(`catalog.status.${step}`)}
              </span>
            ) : (
              <span className={done ? "hidden text-foreground sm:inline" : "hidden text-muted-foreground sm:inline"}>
                {t(`catalog.status.${step}`)}
              </span>
            )}
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border sm:w-8" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** "26/11, 14:00-17:00" in the allocation's time zone. */
function formatWorkWindow(allocation: OrderAllocation, locale: string): string {
  const timeZone = resolveTenantTimeZone(allocation.timeZoneId)
  const start = new Date(allocation.plannedWorkStart)
  const end = new Date(allocation.plannedWorkEnd)
  const day = new Intl.DateTimeFormat(locale, { timeZone, day: "2-digit", month: "2-digit" }).format(start)
  const hm = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  return `${day}, ${hm.format(start)}–${hm.format(end)}`
}

export function CatalogOrderDetailPage({ unified = false }: { unified?: boolean }) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const params = useParams()
  const navigate = useNavigate()
  const { can, activeModules } = usePermissions()
  const orderId = params.orderId ?? ""

  const [order, setOrder] = useState<CatalogOrder | null>(null)
  useBreadcrumbTitle(unified && order ? `#${order.orderNumber}` : null)
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
  const [resources, setResources] = useState<Record<string, OrderResourceFact>>({})

  const form = useForm<CatalogReasonFormValues>({
    resolver: zodResolver(catalogReasonFormSchema),
    defaultValues: { reason: "" },
  })
  const reasonValues = useWatch({ control: form.control })
  const usage = useAllocationUsage(order, setOrder)

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

  const resourceProductIds = order?.items
    .filter((item) => item.productionSummary !== "NotRequired")
    .map((item) => item.productId)
    .join(",") ?? ""

  const modulesKey = activeModules.join(",")

  useEffect(() => {
    const ids = resourceProductIds.split(",").filter((id) => id.length > 0)
    if (ids.length === 0) {
      return
    }
    let cancelled = false
    void (async () => {
      const assets = await listCatalogResourceNames(modulesKey.split(","))
      const entries = await Promise.all(ids.map(async (productId) => {
        try {
          const data = await getCatalogProductResourceRequirements(productId)
          return [productId, orderResourceFact(data.requirements, assets)] as const
        } catch {
          return [productId, { kind: "none" as const }] as const
        }
      }))
      if (!cancelled) {
        setResources(Object.fromEntries(entries))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resourceProductIds, modulesKey])

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

  const needsResourceApproval = order.items.some(
    (item) => item.productionSummary === "Unscheduled",
  )
  const actions = B2B_ORDER_ACTIONS[order.status]
  const canManage = can("catalog.orders.manage")
  const totalLabel = formatOrderTotalText(order, i18n.language, {
    onRequest: t("catalog.priceOnRequest"),
    partial: (amount) => t("catalog.knownPlusOnRequest", { amount }),
  })

  // One primary action: the next order transition, else the resource-usage step.
  const orderPrimary: Exclude<B2BOrderAction, "reject" | "cancel"> | null =
    !canManage
      ? null
      : actions.includes("approve") && !needsResourceApproval
        ? "approve"
        : actions.includes("preparing")
          ? "preparing"
          : actions.includes("ready")
            ? "ready"
            : actions.includes("complete")
              ? "complete"
              : null
  const usagePrimary: "work-finished" | "release" | null =
    orderPrimary != null
      ? null
      : usage.canFinish
        ? "work-finished"
        : usage.canRelease
          ? "release"
          : null
  const showReject = canManage && actions.includes("reject")
  const showCancel = canManage && actions.includes("cancel")
  const menuFinish = usage.canFinish && usagePrimary !== "work-finished"
  const menuRelease = usage.canRelease && usagePrimary !== "release"
  const agendaPath = allocationAgendaLink(usage.allocation, can)
  const hasMenu = showReject || showCancel || menuFinish || menuRelease || agendaPath != null
  const primaryLabel = orderPrimary
    ? t(`catalog.orders.actions.${orderPrimary}`)
    : usagePrimary === "work-finished"
      ? t("catalog.resourcePlanning.activeUse.workFinished")
      : usagePrimary === "release"
        ? t("catalog.resourcePlanning.activeUse.release")
        : null
  const primaryBusy = orderPrimary
    ? busyAction === orderPrimary
    : usagePrimary != null && usage.busyAction === usagePrimary
  const usageLine = usage.allocation
    ? `${t("catalog.orders.resourceUsage")}: ${t(`catalog.resourcePlanning.allocationStatus.${usage.allocation.status}`)}`
    : null

  return (
    <div className={unified ? "staff-catalog staff-catalog-detail mx-auto min-w-0 space-y-5 [overflow-wrap:anywhere]" : "staff-catalog staff-catalog-detail space-y-6"}>
      <PageHeader
        className="min-w-0 [&_h1]:tabular-nums"
        title={unified ? t("pedidos.detailTitle") : order.displayNumber}
        description={<>{order.customerName}{order.customerEmail ? ` · ${order.customerEmail}` : ""}</>}
        actions={primaryLabel != null || hasMenu ? (
          <div className="flex items-center gap-2">
            {primaryLabel != null ? (
              <LoadingButton
                type="button"
                className="touch-target"
                loading={primaryBusy}
                onClick={() => {
                  if (orderPrimary) {
                    void runAction(orderPrimary)
                  } else if (usagePrimary) {
                    void usage.runUsage(usagePrimary)
                  }
                }}
              >
                {primaryLabel}
              </LoadingButton>
            ) : null}
            {hasMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={t("catalog.orders.moreActions")}
                    />
                  }
                >
                  <MoreHorizontal aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuFinish ? (
                    <DropdownMenuItem
                      className="min-h-11 py-2.5"
                      onClick={() => {
                        void usage.runUsage("work-finished")
                      }}
                    >
                      {t("catalog.resourcePlanning.activeUse.workFinished")}
                    </DropdownMenuItem>
                  ) : null}
                  {menuRelease ? (
                    <DropdownMenuItem
                      className="min-h-11 py-2.5"
                      onClick={() => {
                        void usage.runUsage("release")
                      }}
                    >
                      {t("catalog.resourcePlanning.activeUse.release")}
                    </DropdownMenuItem>
                  ) : null}
                  {agendaPath ? (
                    <DropdownMenuItem
                      className="min-h-11 py-2.5"
                      onClick={() => {
                        void navigate(agendaPath)
                      }}
                    >
                      {t("catalog.orders.openInAgenda")}
                    </DropdownMenuItem>
                  ) : null}
                  {showReject ? (
                    <DropdownMenuItem
                      className="min-h-11 py-2.5"
                      onClick={() => {
                        form.reset({ reason: "" })
                        setReasonAction("reject")
                      }}
                    >
                      {t("catalog.orders.actions.reject")}
                    </DropdownMenuItem>
                  ) : null}
                  {showCancel ? (
                    <DropdownMenuItem
                      className="min-h-11 py-2.5"
                      onClick={() => {
                        form.reset({ reason: "" })
                        setReasonAction("cancel")
                      }}
                    >
                      {t("catalog.orders.actions.cancel")}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : undefined}
      />

      {!unified && <CatalogTabs active="orders" />}

      <OrderProgress order={order} />
      {usageLine || order.estimatedReadyAt ? (
        <p className="-mt-2 text-sm text-muted-foreground tabular-nums">
          {usageLine}
          {usageLine && order.estimatedReadyAt ? " · " : null}
          {order.estimatedReadyAt
            ? `${t("catalog.orders.estimatedReady")}: ${formatCatalogDate(order.estimatedReadyAt, i18n.language, timeZoneId)}`
            : null}
        </p>
      ) : null}

      {order.status === "Cancelled" && usage.allocation && usage.allocation.status !== "Released" ? (
        <Alert variant="destructive">
          <AlertDescription>{t("catalog.resourcePlanning.activeUse.cancelledHint")}</AlertDescription>
        </Alert>
      ) : null}

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

      <Can permission="catalog.orders.read">
        <CatalogOrderAllocationPanel
          order={order}
          resourceName={Object.values(resources).find((fact) => fact.kind === "named")?.name ?? null}
          preferredUnitId={Object.values(resources).find((fact) => fact.kind === "named")?.unitId ?? null}
          onOrderChange={setOrder}
          onReloadNeeded={() => {
            void load()
          }}
        />
      </Can>

      <section className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("catalog.orders.summary")}</h2>
        <p className="text-sm tabular-nums">
          <span className="text-muted-foreground">
            {t("catalog.orders.total")}:{" "}
          </span>
          {totalLabel}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">
            {t("catalog.orders.customerLabel")}:{" "}
          </span>
          {order.customerName}
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
          {order.items.map((item) => {
            const fact = resources[item.productId]
            const resourceName = fact?.kind === "named" ? fact.name : null
            const windowText = item.allocation
              ? [formatWorkWindow(item.allocation, i18n.language), resourceName].filter(Boolean).join(" · ")
              : null
            return (
            <li
              key={item.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3 text-sm tabular-nums"
            >
              <span className="min-w-0 break-words">
                {item.productName}
                {item.productCode ? ` (${item.productCode})` : ""} ×{" "}
                {item.quantity}
                {windowText ? (
                  <span className="mt-1 block text-muted-foreground">
                    {windowText}
                    {agendaPath ? (
                      <>
                        {" · "}
                        <Link
                          className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                          to={agendaPath}
                        >
                          {t("catalog.orders.openInAgenda")}
                        </Link>
                      </>
                    ) : null}
                  </span>
                ) : fact?.kind === "named" ? (
                  <span className="mt-1 block text-muted-foreground">
                    {t("catalog.resourcePlanning.approvalPanel.resourceNamed", {
                      name: fact.name,
                      minutes: fact.durationMinutesPerUnit,
                    })}
                  </span>
                ) : fact?.kind === "unset" ? (
                  <span className="mt-1 block text-muted-foreground">
                    {t("catalog.resourcePlanning.approvalPanel.resourceUnset")}
                  </span>
                ) : null}
              </span>
              <span>
                {formatCatalogMoney(
                  item.subTotal,
                  item.currency,
                  i18n.language,
                ) ?? t("catalog.priceOnRequest")}
              </span>
            </li>
            )
          })}
        </ul>
      </section>

      <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-medium">{t("catalog.orders.timeline")}</h2>
        <ol className="space-y-2">
          {order.history.map((entry) => {
            const actorLabel =
              entry.actorType === "B2BUser" && entry.actorName
                ? `${t("catalog.actor.B2BUser")} · ${entry.actorName}`
                : t(`catalog.actor.${entry.actorType}`)
            // Usage milestones carry a reason code instead of a status change;
            // render them as their own friendly label and hide the raw code.
            const usageLabelKey = USAGE_HISTORY_LABELS[entry.reason ?? ""]
            return (
            <li
              key={entry.id}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              <p className="font-medium">
                {describeOrderHistoryEntry(entry, t, usageLabelKey ? t(usageLabelKey) : t(`catalog.status.${entry.status}`))}
              </p>
              <p className="tabular-nums text-muted-foreground">
                {actorLabel} ·{" "}
                {formatCatalogDate(entry.createdAt, i18n.language, timeZoneId)}
              </p>
              {entry.reason && !usageLabelKey ? (
                <p className="mt-1 text-muted-foreground">{entry.reason}</p>
              ) : null}
            </li>
            )
          })}
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
