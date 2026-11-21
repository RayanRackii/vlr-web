import { Copy, ExternalLink } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { SelectablePlanCards } from "@/features/billing/components/SelectablePlanCards"
import { billingErrorMessage } from "@/features/billing/lib/billingErrors"
import { freeMonthsOnAnnual, type BillingCycle } from "@/features/billing/lib/planCatalog"
import { usePaymentPolling } from "@/features/billing/lib/usePaymentPolling"
import {
  CHECKOUT_METHODS,
  type CheckoutMethod,
  type CheckoutResult,
  type TenantBillingSubscription,
} from "@/features/billing/schemas/subscriptionSchemas"
import type { PublicPlan } from "@/features/billing/schemas/billingSchemas"
import { changePlan, startCheckout } from "@/features/billing/services/subscriptionService"
import { createAttemptKey } from "@/lib/idempotency"

export type CheckoutDialogMode = "subscribe" | "change"

type CheckoutDialogProps = {
  open: boolean
  mode: CheckoutDialogMode
  plans: readonly PublicPlan[]
  subscription: TenantBillingSubscription
  currentPackageKey: string | null
  onClose: () => void
  /** The subscription changed (plan changed, or payment confirmed): reload the page data. */
  onUpdated: (subscription?: TenantBillingSubscription) => void
}

function isHttpUrl(value: string | null): value is string {
  return value !== null && /^https?:\/\//i.test(value)
}

function pixImageSrc(value: string): string {
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`
}

export function CheckoutDialog(props: CheckoutDialogProps) {
  // Remount on open so every opening starts from the first step with a fresh attempt key.
  return props.open ? <CheckoutDialogBody {...props} /> : null
}

function CheckoutDialogBody({
  mode,
  plans,
  subscription,
  currentPackageKey,
  onClose,
  onUpdated,
}: CheckoutDialogProps) {
  const { t } = useTranslation()
  const attemptKey = useRef(createAttemptKey())
  const [planId, setPlanId] = useState<string | null>(subscription.planCatalogId)
  const [cycle, setCycle] = useState<BillingCycle>(
    subscription.billingCycle === "annual" ? "annual" : "monthly",
  )
  const [method, setMethod] = useState<CheckoutMethod>("pix")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckoutResult | null>(null)

  const paymentState = usePaymentPolling(result !== null, () => {
    toast.success(t("billing.checkout.paidToast"))
    onUpdated()
    onClose()
  })

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null
  const unchanged =
    mode === "change" &&
    selectedPlan !== null &&
    selectedPlan.id === subscription.planCatalogId &&
    cycle === subscription.billingCycle
  const annualBadge = selectedPlan !== null && freeMonthsOnAnnual(selectedPlan) > 0

  async function submit() {
    if (selectedPlan === null || submitting) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (mode === "change") {
        const updated = await changePlan({ planCatalogId: selectedPlan.id, billingCycle: cycle })
        toast.success(t("billing.change.success"))
        onUpdated(updated)
        onClose()
        return
      }
      const request = { planCatalogId: selectedPlan.id, billingCycle: cycle, method }
      const key = attemptKey.current.keyFor(`${request.planCatalogId}|${request.billingCycle}|${request.method}`)
      const checkout = await startCheckout(request, key)
      attemptKey.current.reset()
      setResult(checkout)
    } catch (caught: unknown) {
      setError(billingErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  async function copyPix(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t("billing.checkout.copied"))
    } catch {
      toast.error(t("billing.checkout.copyFailed"))
    }
  }

  const invoiceUrl = result !== null && isHttpUrl(result.invoiceUrl) ? result.invoiceUrl : null

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !submitting) {
          if (result !== null) {
            onUpdated()
          }
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "change" ? t("billing.change.title") : t("billing.checkout.title")}
          </DialogTitle>
          <DialogDescription>
            {result !== null
              ? t("billing.checkout.payDescription")
              : mode === "change"
                ? t("billing.change.description")
                : t("billing.checkout.description")}
          </DialogDescription>
        </DialogHeader>

        {result === null ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <SegmentedControl<BillingCycle>
                label={t("landing.pricingPage.cycleSwitcher")}
                value={cycle}
                options={[
                  { value: "monthly", label: t("landing.pricingPage.monthly") },
                  { value: "annual", label: t("landing.pricingPage.annual") },
                ]}
                onChange={setCycle}
                disabled={submitting}
              />
              {annualBadge ? (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {t("landing.pricingPage.annualBadge")}
                </span>
              ) : null}
            </div>

            <SelectablePlanCards
              plans={plans}
              cycle={cycle}
              selectedPlanId={planId}
              currentPlanId={subscription.planCatalogId}
              initialPackage={currentPackageKey}
              onSelect={setPlanId}
            />

            {mode === "subscribe" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("billing.checkout.methodLabel")}</p>
                <SegmentedControl<CheckoutMethod>
                  label={t("billing.checkout.methodLabel")}
                  value={method}
                  options={CHECKOUT_METHODS.map((key) => ({
                    value: key,
                    label: t(`billing.checkout.methods.${key}`),
                  }))}
                  onChange={setMethod}
                  disabled={submitting}
                />
              </div>
            ) : null}

            {error !== null ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="info" role="status">
              <AlertDescription>
                {paymentState === "timeout"
                  ? t("billing.checkout.waitingTimeout")
                  : t("billing.checkout.waiting")}
              </AlertDescription>
            </Alert>

            {result.pixQrCode !== null ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={pixImageSrc(result.pixQrCode)}
                  alt={t("billing.checkout.pixQrAlt")}
                  className="size-48 rounded-lg border bg-white p-2"
                />
                <p className="text-xs text-muted-foreground">{t("billing.checkout.pixHint")}</p>
              </div>
            ) : null}

            {result.pixCopyPaste !== null ? (
              <div className="flex gap-2">
                <Input aria-label={t("billing.checkout.pixCopyLabel")} readOnly value={result.pixCopyPaste} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void copyPix(result.pixCopyPaste ?? "")
                  }}
                >
                  <Copy aria-hidden="true" />
                  {t("billing.checkout.copy")}
                </Button>
              </div>
            ) : null}

            {invoiceUrl !== null ? (
              <Button
                variant="outline"
                render={<a href={invoiceUrl} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink aria-hidden="true" />
                {t("billing.checkout.openInvoice")}
              </Button>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {result === null ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                {t("common.cancel")}
              </Button>
              <LoadingButton
                type="button"
                loading={submitting}
                disabled={selectedPlan === null || unchanged}
                onClick={() => {
                  void submit()
                }}
              >
                {mode === "change" ? t("billing.change.confirm") : t("billing.checkout.confirm")}
              </LoadingButton>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onUpdated()
                onClose()
              }}
            >
              {t("common.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
