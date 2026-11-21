import { CreditCard } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Page } from "@/components/layout/Page"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingButton } from "@/components/ui/loading-button"
import { StatusBadge } from "@/components/ui/status"
import { CheckoutDialog, type CheckoutDialogMode } from "@/features/billing/components/CheckoutDialog"
import { billingErrorMessage } from "@/features/billing/lib/billingErrors"
import { formatCents } from "@/features/billing/lib/planCatalog"
import {
  KNOWN_STATUSES,
  canManagePaidPlan,
  canSubscribe,
  statusTone,
  usageRows,
} from "@/features/billing/lib/subscriptionView"
import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"
import type {
  BillingPlansResult,
  TenantBillingSubscription,
} from "@/features/billing/schemas/subscriptionSchemas"
import {
  cancelSubscription,
  getBillingPlans,
  getMySubscription,
} from "@/features/billing/services/subscriptionService"
import { formatLocaleCivilDate, formatLocaleCurrency, formatLocaleDateTime } from "@/lib/localeFormat"
import { cn } from "@/lib/utils"

const CIVIL_DAY = /^\d{4}-\d{2}-\d{2}$/

function formatWhen(value: string | null, locale: string): string | null {
  if (value === null) {
    return null
  }
  return CIVIL_DAY.test(value) ? formatLocaleCivilDate(value, locale) : formatLocaleDateTime(value, locale)
}

function formatMoney(cents: number, currency: string, locale: string): string {
  return formatLocaleCurrency(cents / 100, currency, locale)
}

type Loaded = { subscription: TenantBillingSubscription; plans: BillingPlansResult }

async function fetchBilling(): Promise<Loaded> {
  const [subscription, plans] = await Promise.all([
    getMySubscription(),
    getBillingPlans().catch(
      (): BillingPlansResult => ({
        currentPlanCatalogId: null,
        currentPackageKey: null,
        currentBillingCycle: null,
        plans: [],
      }),
    ),
  ])
  return { subscription, plans }
}

export function BillingPlanPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [data, setData] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [dialogMode, setDialogMode] = useState<CheckoutDialogMode | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    void fetchBilling()
      .then((loaded) => {
        if (!cancelled) {
          setData(loaded)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const header = {
    icon: CreditCard,
    title: t("billing.page.title"),
    description: t("billing.page.description"),
  }

  if (loadError && data === null) {
    return (
      <Page
        header={header}
        state="error"
        error={t("billing.page.loadError")}
        onRetry={() => {
          setLoadError(false)
          reload()
        }}
      >
        {null}
      </Page>
    )
  }
  if (data === null) {
    return (
      <Page header={header} state="loading">
        {null}
      </Page>
    )
  }

  const { subscription, plans } = data
  const pendingPlan: PublicPlan | undefined =
    subscription.pendingPlanCatalogId !== null
      ? plans.plans.find((plan) => plan.id === subscription.pendingPlanCatalogId)
      : undefined
  const status = subscription.status
  const statusLabel =
    status !== null && (KNOWN_STATUSES as readonly string[]).includes(status)
      ? t(`billing.status.${status}`)
      : t("billing.status.unknown")
  const periodEnd = formatWhen(subscription.currentPeriodEnd, locale)
  const nextCharge = formatWhen(subscription.nextChargeAt, locale)
  const trialEnds = formatWhen(subscription.trialEndsAt, locale)
  const discountUntil = formatWhen(subscription.discountUntil, locale)
  const hasDiscount = subscription.effectiveDiscountPercent > 0
  const manual = subscription.hasSubscription && subscription.billingMode === "manual"
  const events = subscription.events.filter((event) => event.type !== null)

  async function handleCancel() {
    setCanceling(true)
    setCancelError(null)
    try {
      const updated = await cancelSubscription()
      setData((current) => (current === null ? current : { ...current, subscription: updated }))
      setConfirmCancel(false)
      toast.success(t("billing.cancel.success"))
    } catch (error: unknown) {
      setCancelError(billingErrorMessage(error))
    } finally {
      setCanceling(false)
    }
  }

  return (
    <Page header={header}>
      <div className="space-y-5">
        {subscription.cancelAtPeriodEnd ? (
          <Alert variant="warning" role="status">
            <AlertDescription>
              {periodEnd !== null
                ? t("billing.notices.cancelAtPeriodEnd", { date: periodEnd })
                : t("billing.notices.cancelAtPeriodEndNoDate")}
            </AlertDescription>
          </Alert>
        ) : null}
        {subscription.pendingPlanCatalogId !== null ? (
          <Alert variant="info" role="status">
            <AlertDescription>
              {t("billing.notices.pendingPlan", {
                plan: pendingPlan?.name ?? t("billing.notices.pendingPlanUnknown"),
                date: periodEnd ?? "—",
              })}
            </AlertDescription>
          </Alert>
        ) : null}
        {status === "past_due" ? (
          <Alert variant="warning" role="status">
            <AlertDescription>{t("billing.notices.pastDue")}</AlertDescription>
          </Alert>
        ) : null}
        {status === "read_only" ? (
          <Alert variant="destructive" role="status">
            <AlertDescription>{t("billing.notices.readOnly")}</AlertDescription>
          </Alert>
        ) : null}
        {manual ? (
          <Alert variant="info" role="status">
            <AlertDescription>{t("billing.notices.manual")}</AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{t("billing.current.title")}</CardTitle>
              {subscription.hasSubscription ? (
                <StatusBadge tone={statusTone(status)}>{statusLabel}</StatusBadge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!subscription.hasSubscription ? (
              <p className="text-sm text-muted-foreground">{t("billing.current.none")}</p>
            ) : (
              <>
                <div>
                  <p className="text-xl font-semibold">{subscription.planName ?? "—"}</p>
                  {subscription.billingCycle !== null ? (
                    <p className="text-sm text-muted-foreground">
                      {subscription.billingCycle === "annual"
                        ? t("billing.current.cycleAnnual")
                        : t("billing.current.cycleMonthly")}
                    </p>
                  ) : null}
                </div>
                <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {subscription.chargeCents !== null ? (
                    <div>
                      <dt className="text-muted-foreground">{t("billing.current.charge")}</dt>
                      <dd className="font-medium">
                        {formatMoney(subscription.chargeCents, subscription.currency, locale)}
                        {subscription.monthlyEquivalentCents !== null &&
                        subscription.billingCycle === "annual" ? (
                          <span className="ml-1 font-normal text-muted-foreground">
                            {t("billing.current.monthlyEquivalent", {
                              price: formatCents(
                                subscription.monthlyEquivalentCents,
                                subscription.currency,
                                locale,
                              ),
                            })}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                  {status === "trialing" && trialEnds !== null ? (
                    <div>
                      <dt className="text-muted-foreground">{t("billing.current.trialEnds")}</dt>
                      <dd className="font-medium">{trialEnds}</dd>
                    </div>
                  ) : null}
                  {nextCharge !== null ? (
                    <div>
                      <dt className="text-muted-foreground">{t("billing.current.nextCharge")}</dt>
                      <dd className="font-medium">{nextCharge}</dd>
                    </div>
                  ) : null}
                  {periodEnd !== null ? (
                    <div>
                      <dt className="text-muted-foreground">{t("billing.current.periodEnd")}</dt>
                      <dd className="font-medium">{periodEnd}</dd>
                    </div>
                  ) : null}
                  {hasDiscount ? (
                    <div>
                      <dt className="text-muted-foreground">{t("billing.current.discount")}</dt>
                      <dd className="font-medium">
                        {discountUntil !== null
                          ? t("billing.current.discountUntil", {
                              percent: subscription.effectiveDiscountPercent,
                              date: discountUntil,
                            })
                          : t("billing.current.discountForever", {
                              percent: subscription.effectiveDiscountPercent,
                            })}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              {canSubscribe(subscription) ? (
                <Button type="button" onClick={() => setDialogMode("subscribe")}>
                  {t("billing.actions.subscribe")}
                </Button>
              ) : null}
              {canManagePaidPlan(subscription) ? (
                <Button type="button" variant="outline" onClick={() => setDialogMode("change")}>
                  {t("billing.actions.changePlan")}
                </Button>
              ) : null}
              {canManagePaidPlan(subscription) && !subscription.cancelAtPeriodEnd ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    setCancelError(null)
                    setConfirmCancel(true)
                  }}
                >
                  {t("billing.actions.cancel")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {subscription.hasSubscription ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("billing.usage.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {usageRows(subscription).map((row) => {
                const name = t(`billing.usage.names.${row.key}`)
                const valueText =
                  row.limit === null
                    ? t("billing.usage.ofUnlimited", { used: row.used })
                    : t("billing.usage.ofLimit", { used: row.used, limit: row.limit })
                return (
                  <div key={row.key} data-testid={`usage-${row.key}`}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{valueText}</span>
                    </div>
                    {row.limit !== null ? (
                      <div
                        role="progressbar"
                        aria-label={name}
                        aria-valuemin={0}
                        aria-valuemax={row.limit}
                        aria-valuenow={Math.min(row.used, row.limit)}
                        aria-valuetext={valueText}
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.ratio >= 1
                              ? "bg-destructive"
                              : row.ratio >= 0.8
                                ? "bg-amber-500"
                                : "bg-primary",
                          )}
                          style={{ width: `${Math.round(row.ratio * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("billing.history.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("billing.history.empty")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {events.map((event) => {
                  const label = t(`billing.history.types.${event.type}`, {
                    defaultValue: event.type ?? "",
                  })
                  const due = formatWhen(event.dueDate, locale)
                  return (
                    <li
                      key={event.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">
                        {event.valueCents !== null
                          ? `${formatMoney(event.valueCents, subscription.currency, locale)} · `
                          : ""}
                        {due !== null ? `${t("billing.history.due", { date: due })} · ` : ""}
                        {formatLocaleDateTime(event.createdAt, locale)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CheckoutDialog
        open={dialogMode !== null}
        mode={dialogMode ?? "subscribe"}
        plans={plans.plans}
        subscription={subscription}
        currentPackageKey={plans.currentPackageKey ?? subscription.packageKey}
        onClose={() => setDialogMode(null)}
        onUpdated={(updated) => {
          if (updated !== undefined) {
            setData((current) => (current === null ? current : { ...current, subscription: updated }))
          }
          reload()
        }}
      />

      <AlertDialog
        open={confirmCancel}
        onOpenChange={(open) => {
          if (!canceling && !open) {
            setConfirmCancel(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("billing.cancel.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {periodEnd !== null
                ? t("billing.cancel.description", { date: periodEnd })
                : t("billing.cancel.descriptionNoDate")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelError !== null ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{cancelError}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling} />
            <LoadingButton
              type="button"
              variant="destructive"
              loading={canceling}
              onClick={() => {
                void handleCancel()
              }}
            >
              {t("billing.cancel.confirm")}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
