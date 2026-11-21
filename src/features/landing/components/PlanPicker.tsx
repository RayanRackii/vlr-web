import { Check } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { moduleNameI18nKey } from "@/features/admin/moduleCatalog"
import {
  availablePackages,
  displayMonthlyCents,
  formatCents,
  freeMonthsOnAnnual,
  listedLimits,
  plansForPackage,
  type BillingCycle,
} from "@/features/billing/lib/planCatalog"
import {
  buildOnboardingHref,
  type PassthroughParams,
} from "@/features/billing/lib/leadAttribution"
import {
  isPlanKey,
  type PackageKey,
  type PublicPlan,
} from "@/features/billing/schemas/billingSchemas"
import type { PublicPlansStatus } from "@/features/billing/lib/usePublicPlans"
import { cn } from "@/lib/utils"

const FEATURED_PLAN_KEY = "profissional"

type PlanPickerProps = {
  plans: readonly PublicPlan[]
  status: PublicPlansStatus
  initialPackage: PackageKey | null
  passthrough: PassthroughParams
  onRetry: () => void
}

/** Package switcher, monthly/annual toggle and one card per plan of the selected package. */
export function PlanPicker({
  plans,
  status,
  initialPackage,
  passthrough,
  onRetry,
}: PlanPickerProps) {
  const { t, i18n } = useTranslation()
  const packages = useMemo(() => availablePackages(plans), [plans])
  const [selectedPackage, setSelectedPackage] = useState<PackageKey | null>(
    initialPackage,
  )
  const [cycle, setCycle] = useState<BillingCycle>("monthly")

  const activePackage =
    selectedPackage !== null && packages.includes(selectedPackage)
      ? selectedPackage
      : (packages[0] ?? "reservas")
  const packagePlans = plansForPackage(plans, activePackage)

  return (
    <div>
      <div className="flex flex-col items-center gap-4">
        <SegmentedControl<PackageKey>
          label={t("landing.pricingPage.packageSwitcher")}
          value={activePackage}
          options={packages.map((key) => ({
            value: key,
            label: t(`billing.packages.${key}.name`),
          }))}
          onChange={setSelectedPackage}
          className="max-w-full flex-wrap justify-center"
        />
        <p className="text-sm text-muted-foreground">
          {t(`billing.packages.${activePackage}.tagline`)}
        </p>
        <div className="flex items-center gap-3">
          <SegmentedControl<BillingCycle>
            label={t("landing.pricingPage.cycleSwitcher")}
            value={cycle}
            options={[
              { value: "monthly", label: t("landing.pricingPage.monthly") },
              { value: "annual", label: t("landing.pricingPage.annual") },
            ]}
            onChange={setCycle}
          />
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {t("landing.pricingPage.annualBadge")}
          </span>
        </div>
      </div>

      {status === "loading" ? (
        <p className="mt-12 text-center text-muted-foreground" role="status">
          {t("landing.pricingPage.loading")}
        </p>
      ) : null}

      {status === "error" ? (
        <div className="mt-12 text-center" role="alert">
          <p className="text-muted-foreground">{t("landing.pricingPage.error")}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
            {t("landing.pricingPage.retry")}
          </Button>
        </div>
      ) : null}

      {status === "ready" && packagePlans.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">
          {t("landing.pricingPage.empty")}
        </p>
      ) : null}

      {status === "ready" && packagePlans.length > 0 ? (
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {packagePlans.map((plan) => {
            const featured = plan.planKey === FEATURED_PLAN_KEY
            const freeMonths = freeMonthsOnAnnual(plan)
            const href = buildOnboardingHref({
              packageKey: activePackage,
              planKey: isPlanKey(plan.planKey) ? plan.planKey : null,
              passthrough,
            })

            return (
              <article
                key={plan.id}
                data-testid={`plan-card-${plan.planKey}`}
                className={cn(
                  "flex flex-col rounded-2xl border p-6 shadow-sm",
                  featured
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3
                    className={cn(
                      "text-sm font-semibold uppercase tracking-wide",
                      featured ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {plan.name}
                  </h3>
                  {featured ? (
                    <span className="rounded-full bg-background/15 px-2.5 py-0.5 text-xs font-medium">
                      {t("landing.pricingPage.featured")}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 text-4xl font-bold tracking-tight">
                  {formatCents(
                    displayMonthlyCents(plan, cycle),
                    plan.currency,
                    i18n.language,
                  )}
                  <span
                    className={cn(
                      "ml-1 text-base font-medium",
                      featured ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {t("landing.pricingPage.perMonth")}
                  </span>
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm",
                    featured ? "text-background/75" : "text-muted-foreground",
                  )}
                >
                  {cycle === "annual" && plan.annualPriceCents > 0
                    ? `${t("landing.pricingPage.billedAnnually", {
                        price: formatCents(
                          plan.annualPriceCents,
                          plan.currency,
                          i18n.language,
                        ),
                      })}${
                        freeMonths > 0
                          ? ` · ${t("landing.pricingPage.freeMonths", { count: freeMonths })}`
                          : ""
                      }`
                    : t("landing.pricingPage.billedMonthly")}
                </p>

                <ul
                  className={cn(
                    "mt-6 flex-1 space-y-2.5 text-sm",
                    featured ? "text-background/85" : "text-muted-foreground",
                  )}
                >
                  {listedLimits(plan.limits).map(({ key, value }) => (
                    <li key={key} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        {value === null
                          ? t(`billing.limitsUnlimited.${key}`)
                          : t(`billing.limits.${key}`, { count: value })}
                      </span>
                    </li>
                  ))}
                  {plan.modules.length > 0 ? (
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        {t("landing.pricingPage.includes")}:{" "}
                        {plan.modules.map((key) => t(moduleNameI18nKey(key))).join(", ")}
                      </span>
                    </li>
                  ) : null}
                </ul>

                <Button
                  size="lg"
                  className="mt-8 w-full"
                  variant={featured ? "secondary" : "default"}
                  render={<Link to={href} />}
                >
                  {t("landing.pricingPage.cta")}
                </Button>
                <p
                  className={cn(
                    "mt-3 text-center text-xs",
                    featured ? "text-background/65" : "text-muted-foreground",
                  )}
                >
                  {t("landing.pricingPage.trialNote")}
                </p>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
