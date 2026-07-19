import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function ClosingSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section
      aria-labelledby="landing-closing-title"
      className="border-b border-border bg-foreground py-20 text-background md:py-28"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center md:px-12">
        <h2
          id="landing-closing-title"
          className="text-balance text-3xl font-bold tracking-tight md:text-5xl"
        >
          {t("landing.closing.title")}
        </h2>
        <p className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-background/75 md:text-lg">
          {t("landing.closing.subtitle")}
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={() => {
              void navigate("/onboarding")
            }}
          >
            {t("landing.cta.primary")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
            render={<a href="#contact" />}
          >
            {t("landing.cta.secondary")}
          </Button>
        </div>
        <p className="mt-4 text-xs text-background/60">
          {t("landing.cta.microcopy")}
        </p>
      </div>
    </section>
  )
}
