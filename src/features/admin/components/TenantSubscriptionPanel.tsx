import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { ErrorState } from "@/components/ErrorState"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status"
import type { StatusTone } from "@/components/ui/status-tones"
import { formatCents } from "@/features/billing/lib/planCatalog"
import {
  BILLING_CYCLES,
  BILLING_MODES,
  SUBSCRIPTION_STATUSES,
  type PublicPlan,
  type TenantSubscription,
} from "@/features/billing/schemas/billingSchemas"
import {
  getPublicPlans,
  getTenantSubscription,
  putTenantSubscription,
} from "@/features/billing/services/billingService"
import { formatLocaleDateTime } from "@/lib/localeFormat"

import {
  buildSubscriptionRequest,
  toFormState,
  type SubscriptionFormState,
} from "@/features/admin/lib/subscriptionForm"

const STATUS_TONES: Record<string, StatusTone> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  read_only: "danger",
  canceled: "neutral",
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; subscription: TenantSubscription; plans: PublicPlan[] }

/** Platform-admin panel to view and edit one tenant's subscription (plan, cycle, status, discount, coupon). */
export function TenantSubscriptionPanel({ tenantId }: { tenantId: string }) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [form, setForm] = useState<SubscriptionFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setState({ status: "loading" })
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getTenantSubscription(tenantId),
      // The catalog only feeds the plan list: the panel still works without it.
      getPublicPlans().catch((): PublicPlan[] => []),
    ])
      .then(([subscription, plans]) => {
        if (!cancelled) {
          setState({ status: "ready", subscription, plans })
          setForm(toFormState(subscription))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" })
        }
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, attempt])

  const planItems = useMemo(() => {
    if (state.status !== "ready") {
      return []
    }
    const items = state.plans.map((plan) => ({
      value: plan.id,
      label: t("admin.subscription.planOption", {
        package: t(`billing.packages.${plan.packageKey}.name`, {
          defaultValue: plan.packageKey,
        }),
        plan: plan.name,
        price: formatCents(plan.monthlyPriceCents, plan.currency, i18n.language),
      }),
    }))
    const current = state.subscription
    if (
      current.planCatalogId !== null &&
      !items.some((item) => item.value === current.planCatalogId)
    ) {
      items.unshift({
        value: current.planCatalogId,
        label: current.planName ?? current.planCatalogId,
      })
    }
    return items
  }, [i18n.language, state, t])

  const statusItems = SUBSCRIPTION_STATUSES.map((value) => ({
    value,
    label: t(`admin.subscription.statuses.${value}`),
  }))

  if (state.status === "error") {
    return <ErrorState message={t("admin.subscription.loadError")} onRetry={retry} />
  }

  if (state.status === "loading" || form === null) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("admin.subscription.loading")}
      </p>
    )
  }

  const { subscription } = state
  const request = buildSubscriptionRequest(subscription, form)
  const dirty = Object.keys(request).length > 0

  function update(patch: Partial<SubscriptionFormState>) {
    setForm((current) => (current === null ? current : { ...current, ...patch }))
  }

  async function save() {
    if (!dirty) {
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await putTenantSubscription(tenantId, request)
      setState((current) =>
        current.status === "ready" ? { ...current, subscription: saved } : current,
      )
      setForm(toFormState(saved))
      toast.success(t("admin.subscription.saved"))
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.subscription.errors.saveFailed"),
      )
    } finally {
      setSaving(false)
    }
  }

  const statusKey = subscription.status ?? "trialing"
  const currency = subscription.currency ?? "BRL"

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t("admin.subscription.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("admin.subscription.description")}
        </p>
      </div>

      {subscription.hasSubscription ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t("admin.subscription.fields.status")}</dt>
            <dd className="mt-1">
              <StatusBadge tone={STATUS_TONES[statusKey] ?? "neutral"}>
                {t(`admin.subscription.statuses.${statusKey}`, { defaultValue: statusKey })}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("admin.subscription.summary.monthlyEquivalent")}
            </dt>
            <dd className="mt-1 font-medium">
              {formatCents(subscription.monthlyEquivalentCents, currency, i18n.language)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("admin.subscription.summary.discount")}
            </dt>
            <dd className="mt-1 font-medium">{subscription.effectiveDiscountPercent}%</dd>
          </div>
          {subscription.currentPeriodEnd ? (
            <div>
              <dt className="text-muted-foreground">
                {t("admin.subscription.summary.period")}
              </dt>
              <dd className="mt-1">
                {subscription.currentPeriodStart
                  ? `${formatLocaleDateTime(subscription.currentPeriodStart, i18n.language)} → `
                  : ""}
                {formatLocaleDateTime(subscription.currentPeriodEnd, i18n.language)}
              </dd>
            </div>
          ) : null}
          {subscription.pastDueSince ? (
            <div>
              <dt className="text-muted-foreground">
                {t("admin.subscription.summary.pastDueSince")}
              </dt>
              <dd className="mt-1">
                {formatLocaleDateTime(subscription.pastDueSince, i18n.language)}
              </dd>
            </div>
          ) : null}
          {subscription.provider ? (
            <div>
              <dt className="text-muted-foreground">
                {t("admin.subscription.summary.provider")}
              </dt>
              <dd className="mt-1">{subscription.provider}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{t("admin.subscription.none")}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="subscription-plan">{t("admin.subscription.fields.plan")}</Label>
          <Select
            modal={false}
            value={form.planCatalogId}
            onValueChange={(value) => {
              if (typeof value === "string") {
                update({ planCatalogId: value })
              }
            }}
            items={planItems}
          >
            <SelectTrigger id="subscription-plan" className="min-h-11 w-full">
              <SelectValue placeholder={t("admin.subscription.fields.plan")} />
            </SelectTrigger>
            <SelectContent>
              {planItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("admin.subscription.fields.cycle")}</Label>
          <div>
            <SegmentedControl
              label={t("admin.subscription.fields.cycle")}
              value={form.billingCycle}
              options={BILLING_CYCLES.map((value) => ({
                value,
                label: t(`admin.subscription.cycles.${value}`),
              }))}
              onChange={(value) => {
                update({ billingCycle: value })
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("admin.subscription.fields.billingMode")}</Label>
          <div>
            <SegmentedControl
              label={t("admin.subscription.fields.billingMode")}
              value={form.billingMode}
              options={BILLING_MODES.map((value) => ({
                value,
                label: t(`admin.subscription.modes.${value}`),
              }))}
              onChange={(value) => {
                update({ billingMode: value })
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subscription-status">
            {t("admin.subscription.fields.status")}
          </Label>
          <Select
            modal={false}
            value={form.status}
            onValueChange={(value) => {
              if (typeof value === "string") {
                update({ status: value })
              }
            }}
            items={statusItems}
          >
            <SelectTrigger id="subscription-status" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2 pb-2">
          <Checkbox
            id="subscription-unlimited"
            checked={form.limitsUnlimited}
            onChange={(event) => {
              update({ limitsUnlimited: event.target.checked })
            }}
          />
          <Label htmlFor="subscription-unlimited" className="font-normal">
            {t("admin.subscription.fields.limitsUnlimited")}
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subscription-discount">
            {t("admin.subscription.fields.discountPercent")}
          </Label>
          <Input
            id="subscription-discount"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={form.discountPercent}
            onChange={(event) => {
              update({ discountPercent: event.target.value })
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subscription-discount-until">
            {t("admin.subscription.fields.discountUntil")}
          </Label>
          <Input
            id="subscription-discount-until"
            type="date"
            value={form.discountUntil}
            onChange={(event) => {
              update({ discountUntil: event.target.value })
            }}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="subscription-coupon">
            {t("admin.subscription.fields.coupon")}
          </Label>
          <Input
            id="subscription-coupon"
            value={form.coupon}
            autoComplete="off"
            onChange={(event) => {
              update({ coupon: event.target.value })
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t("admin.subscription.fields.couponHint")}
          </p>
        </div>
      </div>

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={!dirty || saving}
        onClick={() => {
          void save()
        }}
      >
        {saving ? t("admin.subscription.saving") : t("admin.subscription.save")}
      </Button>

      <div>
        <h4 className="text-sm font-semibold">{t("admin.subscription.events.title")}</h4>
        {subscription.events.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("admin.subscription.events.empty")}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
            {subscription.events.map((event) => (
              <li key={event.id} className="flex justify-between gap-3 px-4 py-2">
                <span>
                  {t(`admin.subscription.events.types.${event.type ?? "unknown"}`, {
                    defaultValue: t("admin.subscription.events.types.unknown"),
                  })}
                </span>
                <time className="text-muted-foreground" dateTime={event.createdAt}>
                  {formatLocaleDateTime(event.createdAt, i18n.language)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
