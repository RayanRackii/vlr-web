import { useTranslation } from "react-i18next"

import { FeatureScrollReveal } from "@/features/landing/components/FeatureScrollReveal"
import { LandingHeader } from "@/features/landing/components/LandingHeader"

export function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="pt-16">
        <div
          id="features"
          className="flex h-[40vh] items-center justify-center border-b border-border"
        >
          <p className="text-sm text-muted-foreground">{t("landing.scrollHint")}</p>
        </div>

        <FeatureScrollReveal />

        <div
          id="solutions"
          className="flex h-[20vh] items-center justify-center border-t border-border"
        >
          <p className="text-sm text-muted-foreground">
            {t("landing.header.nav.solutions")}
          </p>
        </div>

        <div
          id="pricing"
          className="flex h-[20vh] items-center justify-center border-t border-border"
        >
          <p className="text-sm text-muted-foreground">
            {t("landing.header.nav.pricing")}
          </p>
        </div>

        <div
          id="contact"
          className="flex h-[40vh] items-center justify-center border-t border-border"
        >
          <p className="text-sm text-muted-foreground">{t("landing.sectionEnd")}</p>
        </div>
      </main>
    </div>
  )
}
