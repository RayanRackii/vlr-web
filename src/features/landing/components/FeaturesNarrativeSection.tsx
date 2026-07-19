import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { StepOneGraphic } from "@/features/landing/components/StepOneGraphic"
import { StepThreeAuditGraphic } from "@/features/landing/components/StepThreeAuditGraphic"
import { StepTwoRolesGraphic } from "@/features/landing/components/StepTwoRolesGraphic"
import { StoryStep } from "@/features/landing/components/StoryStep"

export function FeaturesNarrativeSection() {
  const { t } = useTranslation()

  const stepOneParagraphs = [
    t("landing.features.tempo1.description"),
    t("landing.features.tempo1.description2"),
    t("landing.features.tempo1.description3"),
  ] as const

  const stepTwoParagraphs = [
    t("landing.features.tempo2.description"),
    t("landing.features.tempo2.description2"),
    t("landing.features.tempo2.description3"),
  ] as const

  const stepThreeParagraphs = [
    t("landing.features.tempo3.description"),
    t("landing.features.tempo3.description2"),
    t("landing.features.tempo3.description3"),
  ] as const

  return (
    <div>
      <StoryStep
        id="features"
        eyebrow={t("landing.features.tempo1.eyebrow")}
        headline={t("landing.features.tempo1.title")}
        paragraphs={stepOneParagraphs}
      >
        {({ progress, windows, reducedMotion }) => (
          <StepOneGraphic
            progress={progress}
            windows={windows}
            reducedMotion={reducedMotion}
          />
        )}
      </StoryStep>

      <StoryStep
        eyebrow={t("landing.features.tempo2.eyebrow")}
        headline={t("landing.features.tempo2.title")}
        paragraphs={stepTwoParagraphs}
      >
        {({ progress, windows, reducedMotion }) => (
          <StepTwoRolesGraphic
            progress={progress}
            windows={windows}
            reducedMotion={reducedMotion}
          />
        )}
      </StoryStep>

      <StoryStep
        eyebrow={t("landing.features.tempo3.eyebrow")}
        headline={t("landing.features.tempo3.title")}
        paragraphs={stepThreeParagraphs}
      >
        {({ progress, windows, reducedMotion }) => (
          <StepThreeAuditGraphic
            progress={progress}
            windows={windows}
            reducedMotion={reducedMotion}
          />
        )}
      </StoryStep>

      <section className="border-y border-border bg-muted/20 py-16 md:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center md:px-12">
          <p className="text-balance text-lg text-muted-foreground md:text-xl">
            {t("landing.features.bridge.text")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-6"
            render={<a href="#solutions" />}
          >
            {t("landing.features.bridge.cta")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </section>
    </div>
  )
}
