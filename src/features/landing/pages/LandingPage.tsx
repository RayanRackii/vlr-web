import { useTranslation } from "react-i18next"

import { FeatureScrollReveal } from "@/features/landing/components/FeatureScrollReveal"

/**
 * Minimal landing shell for Phase 1 sticky-scroll layout testing.
 * Extra vertical space above/below helps verify sticky enter/exit.
 */
export function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-[40vh] items-center justify-center border-b border-border">
        <p className="text-sm text-muted-foreground">{t("landing.scrollHint")}</p>
      </div>

      <FeatureScrollReveal />

      <div className="flex h-[40vh] items-center justify-center border-t border-border">
        <p className="text-sm text-muted-foreground">{t("landing.sectionEnd")}</p>
      </div>
    </div>
  )
}
