import { Check } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

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
import type { PackageKey, PublicPlan } from "@/features/billing/schemas/billingSchemas"
import { cn } from "@/lib/utils"

type SelectablePlanCardsProps = {
  plans: readonly PublicPlan[]
  cycle: BillingCycle
  selectedPlanId: string | null
  currentPlanId: string | null
  initialPackage: string | null
  onSelect: (planId: string) => void
}

/**
 * Plan cards for the checkout/change dialog. Same data and price helpers as the public pricing
 * page, but the cards select a plan instead of linking to the onboarding.
 */
export function SelectablePlanCards({
  plans,
  cycle,
  selectedPlanId,
  currentPlanId,
  initialPackage,
  onSelect,
}: SelectablePlanCardsProps) {
  const { t, i18n } = useTranslation()
  const packages = useMemo(() => availablePackages(plans), [plans])
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId)
  const [chosenPackage, setChosenPackage] = useState<string | null>(
    selectedPlan?.packageKey ?? initialPackage,
  )
  const activePackage = (
    chosenPackage !== null && packages.some((key) => key === chosenPackage)
      ? chosenPackage
      : (packages[0] ?? "reservas")
  ) as PackageKey
  const packagePlans = plansForPackage(plans, activePackage)

  return (
    <div className="space-y-4">
      {packages.length > 1 ? (
        <SegmentedControl<PackageKey>
          label={t("landing.pricingPage.packageSwitcher")}
          value={activePackage}
          options={packages.map((key) => ({
            value: key,
            label: t(`billing.packages.${key}.name`),
          }))}
          onChange={setChosenPackage}
          className="max-w-full flex-wrap"
        />
      ) : null}

      <div
        role="radiogroup"
        aria-label={t("billing.checkout.planGroup")}
        className="grid gap-3 sm:grid-cols-3"
      >
        {packagePlans.map((plan) => {
          const selected = plan.id === selectedPlanId
          const freeMonths = freeMonthsOnAnnual(plan)
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`checkout-plan-${plan.planKey}`}
              onClick={() => onSelect(plan.id)}
              className={cn(
                "flex flex-col rounded-xl border p-4 text-left transition-colors",
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {plan.name}
                {plan.id === currentPlanId ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t("billing.checkout.currentTag")}
                  </span>
                ) : null}
              </span>
              <span className="mt-2 text-2xl font-bold tracking-tight">
                {formatCents(displayMonthlyCents(plan, cycle), plan.currency, i18n.language)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  {t("landing.pricingPage.perMonth")}
                </span>
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {cycle === "annual" && plan.annualPriceCents > 0
                  ? `${t("landing.pricingPage.billedAnnually", {
                      price: formatCents(plan.annualPriceCents, plan.currency, i18n.language),
                    })}${freeMonths > 0 ? ` · ${t("landing.pricingPage.freeMonths", { count: freeMonths })}` : ""}`
                  : t("landing.pricingPage.billedMonthly")}
              </span>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {listedLimits(plan.limits).map(({ key, value }) => (
                  <li key={key} className="flex gap-1.5">
                    <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {value === null
                        ? t(`billing.limitsUnlimited.${key}`)
                        : value === 0 && key === "whatsappMessagesMonth"
                          ? t(`billing.limitsNone.${key}`)
                          : t(`billing.limits.${key}`, { count: value })}
                    </span>
                  </li>
                ))}
                {plan.modules.length > 0 ? (
                  <li className="flex gap-1.5">
                    <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>{plan.modules.map((key) => t(moduleNameI18nKey(key))).join(", ")}</span>
                  </li>
                ) : null}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}
