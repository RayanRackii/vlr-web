import { Check, ImageIcon } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import {
  buildOnboardingHref,
  resolvePassthroughParams,
} from "@/features/billing/lib/leadAttribution"
import { LandingFooter } from "@/features/landing/components/LandingFooter"
import { LandingHeader } from "@/features/landing/components/LandingHeader"
import { PackagePricingTeaser } from "@/features/landing/components/PackagePricingTeaser"
import { VERTICALS, type VerticalDefinition } from "@/features/landing/verticals"

function indexes(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

/** Generic vertical landing: hero, three benefits, proofs, screenshot slots, pricing teaser and CTA. */
export function VerticalLanding({ vertical }: { vertical: VerticalDefinition }) {
  const { t } = useTranslation()
  const { search } = useLocation()
  const passthrough = useMemo(() => resolvePassthroughParams(search), [search])
  const base = `landing.verticals.${vertical.id}`
  const ctaHref = buildOnboardingHref({
    packageKey: vertical.packageKey,
    passthrough,
  })
  const pricingQuery = new URLSearchParams({
    package: vertical.packageKey,
    ...passthrough,
  }).toString()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="px-4 pb-20 pt-32 sm:px-8 sm:pt-28">
        <Page
          header={{
            eyebrow: t(`${base}.eyebrow`),
            title: t(`${base}.title`),
            description: t(`${base}.subtitle`),
            actions: (
              <>
                <Button size="lg" render={<Link to={ctaHref} />}>
                  {t("landing.verticals.common.cta")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  render={<Link to={`/precos?${pricingQuery}`} />}
                >
                  {t("landing.verticals.common.secondaryCta")}
                </Button>
              </>
            ),
          }}
          className="space-y-14"
        >
          <p className="-mt-8 text-xs text-muted-foreground">
            {t("landing.verticals.common.ctaNote")}
          </p>

          <section aria-labelledby="vertical-benefits-title">
            <h2 id="vertical-benefits-title" className="text-2xl font-semibold">
              {t("landing.verticals.common.benefitsTitle")}
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {vertical.benefitIds.map((benefitId) => (
                <div key={benefitId} className="rounded-2xl border border-border p-6">
                  <h3 className="text-lg font-semibold">
                    {t(`${base}.benefits.${benefitId}.title`)}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {t(`${base}.benefits.${benefitId}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="vertical-proofs-title">
            <h2 id="vertical-proofs-title" className="text-2xl font-semibold">
              {t("landing.verticals.common.proofsTitle")}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {indexes(vertical.proofCount).map((index) => (
                <li key={index} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{t(`${base}.proofs.${index}`)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="vertical-screens-title">
            <h2 id="vertical-screens-title" className="text-2xl font-semibold">
              {t("landing.verticals.common.screenshotsTitle")}
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {indexes(vertical.screenshotCount).map((index) => (
                <figure key={index}>
                  <div
                    className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground"
                    role="img"
                    aria-label={t(`${base}.screenshots.${index}`)}
                  >
                    <ImageIcon className="size-6" aria-hidden="true" />
                    <span className="text-xs">
                      {t("landing.verticals.common.screenshotSoon")}
                    </span>
                  </div>
                  <figcaption className="mt-2 text-sm text-muted-foreground">
                    {t(`${base}.screenshots.${index}`)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="grid justify-items-center gap-8">
            <div className="w-full max-w-xl">
              <PackagePricingTeaser
                packageKey={vertical.packageKey}
                passthrough={passthrough}
              />
            </div>
            <div className="text-center">
              <Button size="lg" render={<Link to={ctaHref} />}>
                {t("landing.verticals.common.cta")}
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("landing.verticals.common.ctaNote")}
              </p>
            </div>
          </section>
        </Page>
      </main>

      <LandingFooter />
    </div>
  )
}

export function ArenasPage() {
  return <VerticalLanding vertical={VERTICALS.arenas} />
}

export function PmocPage() {
  return <VerticalLanding vertical={VERTICALS.pmoc} />
}
