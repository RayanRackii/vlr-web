import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { resolvePassthroughParams } from "@/features/billing/lib/leadAttribution"
import { PACKAGE_KEYS } from "@/features/billing/schemas/billingSchemas"

/** Where each package's "saiba mais" goes: its vertical landing when there is one, else the pricing page. */
const PACKAGE_LINKS = {
  reservas: "/arenas",
  manutencao: "/pmoc",
  locacao: "/precos",
} as const

/** Home teaser: the three packages and a link to the real plans and prices on `/precos`. */
export function PricingSection() {
  const { t } = useTranslation()
  const { search } = useLocation()
  const passthrough = resolvePassthroughParams(search)
  const withParams = (path: string, extra?: Record<string, string>) => {
    const query = new URLSearchParams({ ...extra, ...passthrough }).toString()
    return query.length > 0 ? `${path}?${query}` : path
  }

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
          {PACKAGE_KEYS.map((packageKey) => (
            <div
              key={packageKey}
              className="flex flex-col rounded-2xl border border-border bg-background p-6 shadow-sm"
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`billing.packages.${packageKey}.name`)}
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.pricing.blurbs.${packageKey}`)}
              </p>
              <Link
                to={withParams(PACKAGE_LINKS[packageKey], { package: packageKey })}
                className="mt-6 text-sm font-medium text-primary underline underline-offset-2"
              >
                {t("landing.pricing.learnMore")}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <Button size="lg" render={<Link to={withParams("/precos")} />}>
            {t("landing.pricing.cta")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {t("landing.pricing.reassurance")}
          </p>
        </div>
      </div>
    </section>
  )
}
