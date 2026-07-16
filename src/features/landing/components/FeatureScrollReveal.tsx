import { useTranslation } from "react-i18next"

const FEATURE_KEYS = ["tempo1", "tempo2", "tempo3", "tempo4"] as const

export function FeatureScrollReveal() {
  const { t } = useTranslation()

  return (
    <section
      aria-label={t("landing.features.sectionLabel")}
      className="relative flex w-full"
    >
      {/* Left: scrolling feature copy — 4 × 100vh = 400vh scroll runway */}
      <div className="w-1/2">
        {FEATURE_KEYS.map((key) => (
          <div
            key={key}
            className="flex h-screen items-center px-8 md:px-12 lg:px-16"
          >
            <div className="max-w-md space-y-4">
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {t(`landing.features.${key}.eyebrow`)}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {t(`landing.features.${key}.title`)}
              </h2>
              <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                {t(`landing.features.${key}.description`)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Right: sticky visual plane — stays fixed while left scrolls */}
      <div className="sticky top-0 flex h-screen w-1/2 items-center justify-center bg-slate-200 dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {t("landing.features.animationPlaceholder")}
        </p>
      </div>
    </section>
  )
}
