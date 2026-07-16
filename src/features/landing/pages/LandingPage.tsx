import { useTranslation } from "react-i18next"

import { FeatureScrollReveal } from "@/features/landing/components/FeatureScrollReveal"
import { HeroSection } from "@/features/landing/components/HeroSection"
import { LandingHeader } from "@/features/landing/components/LandingHeader"

export function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      <main className="pt-16">
        <HeroSection />

        <FeatureScrollReveal />

        <div className="flex h-[30vh] items-center justify-center border-t border-border">
          <p className="text-sm text-muted-foreground">{t("landing.sectionEnd")}</p>
        </div>
      </main>
    </div>
  )
}
