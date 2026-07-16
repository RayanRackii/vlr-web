import { ArrowRight, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function HeroSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative flex min-h-[calc(100vh-4rem)] min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4 text-center"
    >
      {/* Radial glow + subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex max-w-4xl flex-col items-center">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          {t("landing.hero.badge")}
        </span>

        <h1
          id="landing-hero-title"
          className="mb-6 text-balance text-5xl font-extrabold tracking-tighter text-foreground md:text-7xl"
        >
          {t("landing.hero.title")}
        </h1>

        <p className="mb-10 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
          {t("landing.hero.subtitle")}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              void navigate("/onboarding")
            }}
          >
            {t("landing.hero.ctaPrimary")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            render={<a href="#pricing" />}
          >
            {t("landing.hero.ctaSecondary")}
          </Button>
        </div>
      </div>

      <a
        href="#features"
        className="relative z-10 mt-auto flex flex-col items-center gap-2 pb-8 pt-12 text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="text-xs">{t("landing.hero.scrollLabel")}</span>
        <ChevronDown className="size-5 animate-bounce" aria-hidden="true" />
      </a>
    </section>
  )
}
