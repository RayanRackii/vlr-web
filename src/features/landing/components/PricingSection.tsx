import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PLAN_IDS = ["starter", "operations", "scale"] as const
const FAQ_IDS = ["card", "data", "goLive"] as const

type PlanId = (typeof PLAN_IDS)[number]

function getPlanFeatures(
  t: (key: string, options?: { returnObjects: true }) => unknown,
  planId: PlanId,
): string[] {
  const value = t(`landing.pricing.plans.${planId}.features`, {
    returnObjects: true,
  })

  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

export function PricingSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section
      id="pricing"
      aria-labelledby="landing-pricing-title"
      className="scroll-mt-16 border-b border-border py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("landing.pricing.eyebrow")}
          </p>
          <h2
            id="landing-pricing-title"
            className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl"
          >
            {t("landing.pricing.title")}
          </h2>
          <p className="mt-5 text-balance text-lg text-muted-foreground">
            {t("landing.pricing.subtitle")}
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLAN_IDS.map((planId) => {
            const featured = planId === "operations"

            return (
              <div
                key={planId}
                className={cn(
                  "flex flex-col rounded-2xl border p-6 shadow-sm",
                  featured
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",
                    featured ? "text-background/70" : "text-muted-foreground",
                  )}
                >
                  {t(`landing.pricing.plans.${planId}.name`)}
                </p>
                <p className="mt-4 text-3xl font-bold tracking-tight">
                  {t(`landing.pricing.plans.${planId}.price`)}
                </p>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    featured ? "text-background/75" : "text-muted-foreground",
                  )}
                >
                  {t(`landing.pricing.plans.${planId}.blurb`)}
                </p>
                <ul
                  className={cn(
                    "mt-6 flex-1 space-y-3 text-sm",
                    featured ? "text-background/85" : "text-muted-foreground",
                  )}
                >
                  {getPlanFeatures(t, planId).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden="true">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="lg"
                  className="mt-8 w-full"
                  variant={featured ? "secondary" : "default"}
                  onClick={() => {
                    void navigate("/onboarding")
                  }}
                >
                  {t("landing.pricing.cta")}
                </Button>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("landing.pricing.reassurance")}
        </p>

        <div className="mx-auto mt-16 max-w-3xl">
          <h3 className="text-center text-xl font-semibold text-foreground">
            {t("landing.pricing.faqTitle")}
          </h3>
          <dl className="mt-8 space-y-6">
            {FAQ_IDS.map((faqId) => (
              <div key={faqId} className="rounded-xl border border-border p-5">
                <dt className="font-semibold text-foreground">
                  {t(`landing.pricing.faq.${faqId}.q`)}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.pricing.faq.${faqId}.a`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
