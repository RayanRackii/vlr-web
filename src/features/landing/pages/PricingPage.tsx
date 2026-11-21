import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"

import { Page } from "@/components/layout/Page"
import { LandingFooter } from "@/features/landing/components/LandingFooter"
import { LandingHeader } from "@/features/landing/components/LandingHeader"
import { PlanPicker } from "@/features/landing/components/PlanPicker"
import { formatCents, PLAN_ADD_ONS } from "@/features/billing/lib/planCatalog"
import {
  readRequestedPackage,
  resolvePassthroughParams,
} from "@/features/billing/lib/leadAttribution"
import { usePublicPlans } from "@/features/billing/lib/usePublicPlans"

const GUARANTEE_KEYS = ["trial", "noLockIn", "noSetupFee", "payment"] as const
const FAQ_KEYS = ["lockIn", "setupFee", "payment", "trial", "annual", "limit"] as const

/** Public pricing page: `/precos` (same page on `rolvix.com.br` and `www`). */
export function PricingPage() {
  const { t, i18n } = useTranslation()
  const { search } = useLocation()
  const { status, plans, reload } = usePublicPlans()
  const passthrough = useMemo(() => resolvePassthroughParams(search), [search])
  const initialPackage = useMemo(() => readRequestedPackage(search), [search])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="px-4 pb-20 pt-32 sm:px-8 sm:pt-28">
        <Page
          header={{
            eyebrow: t("landing.pricingPage.eyebrow"),
            title: t("landing.pricingPage.title"),
            description: t("landing.pricingPage.subtitle"),
          }}
          className="space-y-12"
        >
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {GUARANTEE_KEYS.map((key) => (
              <li key={key}>{t(`landing.pricingPage.guarantees.${key}`)}</li>
            ))}
          </ul>

          <PlanPicker
            plans={plans}
            status={status}
            initialPackage={initialPackage}
            passthrough={passthrough}
            onRetry={reload}
          />

          <section aria-labelledby="pricing-addons-title" className="grid justify-items-center">
            <div className="w-full max-w-3xl">
              <h2 id="pricing-addons-title" className="text-center text-2xl font-semibold">
                {t("landing.pricingPage.addOns.title")}
              </h2>
              <p className="mt-2 text-center text-muted-foreground">
                {t("landing.pricingPage.addOns.subtitle")}
              </p>
              <ul className="mt-8 divide-y divide-border rounded-xl border border-border">
                {PLAN_ADD_ONS.map((addOn) => (
                  <li
                    key={addOn.key}
                    className="flex items-center justify-between gap-4 px-5 py-4 text-sm"
                  >
                    <span className="font-medium">{t(`billing.addOns.${addOn.key}.name`)}</span>
                    <span className="text-muted-foreground">
                      {t(`billing.addOns.${addOn.key}.price`, {
                        price: formatCents(addOn.priceCents, addOn.currency, i18n.language),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("landing.pricingPage.addOns.beyond")}
              </p>
            </div>
          </section>

          <section aria-labelledby="pricing-faq-title" className="grid justify-items-center">
            <div className="w-full max-w-3xl">
              <h2 id="pricing-faq-title" className="text-center text-2xl font-semibold">
                {t("landing.pricingPage.faq.title")}
              </h2>
              <dl className="mt-8 space-y-4">
                {FAQ_KEYS.map((key) => (
                  <div key={key} className="rounded-xl border border-border p-5">
                    <dt className="font-semibold">{t(`landing.pricingPage.faq.${key}.q`)}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t(`landing.pricingPage.faq.${key}.a`)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </Page>
      </main>

      <LandingFooter />
    </div>
  )
}
