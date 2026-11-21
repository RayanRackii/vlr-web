import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { formatCents, plansForPackage } from "@/features/billing/lib/planCatalog"
import type { PassthroughParams } from "@/features/billing/lib/leadAttribution"
import { usePublicPlans } from "@/features/billing/lib/usePublicPlans"
import type { PackageKey } from "@/features/billing/schemas/billingSchemas"

type PackagePricingTeaserProps = {
  packageKey: PackageKey
  passthrough: PassthroughParams
}

/** "A partir de R$ X/mês" for one package, with a link to the full pricing page. */
export function PackagePricingTeaser({ packageKey, passthrough }: PackagePricingTeaserProps) {
  const { t, i18n } = useTranslation()
  const { status, plans } = usePublicPlans()

  const cheapest = plansForPackage(plans, packageKey).reduce<(typeof plans)[number] | null>(
    (best, plan) =>
      best === null || plan.monthlyPriceCents < best.monthlyPriceCents ? plan : best,
    null,
  )

  const query = new URLSearchParams({ package: packageKey, ...passthrough }).toString()

  return (
    <div className="rounded-2xl border border-border p-6 text-center">
      <h3 className="text-xl font-semibold">{t("landing.verticals.common.teaserTitle")}</h3>
      <p className="mt-3 text-3xl font-bold tracking-tight">
        {status === "ready" && cheapest !== null
          ? t("landing.verticals.common.teaserFrom", {
              price: formatCents(cheapest.monthlyPriceCents, cheapest.currency, i18n.language),
            })
          : t("landing.verticals.common.teaserUnavailable")}
      </p>
      <Link
        to={`/precos?${query}`}
        className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-2"
      >
        {t("landing.verticals.common.teaserLink")}
      </Link>
    </div>
  )
}
