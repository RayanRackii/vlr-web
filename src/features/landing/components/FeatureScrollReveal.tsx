import { useRef, useState } from "react"
import { useMotionValueEvent, useScroll } from "framer-motion"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

const FEATURE_KEYS = ["tempo1", "tempo2", "tempo3", "tempo4"] as const

const ACTIVE_PANEL_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-400",
] as const

export function FeatureScrollReveal() {
  const { t } = useTranslation()
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const [activeCard, setActiveCard] = useState(0)

  const { scrollYProgress } = useScroll({
    target: leftColumnRef,
    offset: ["start start", "end end"],
  })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextCard = Math.min(
      FEATURE_KEYS.length - 1,
      Math.floor(latest * FEATURE_KEYS.length),
    )

    setActiveCard((current) => (current === nextCard ? current : nextCard))
  })

  return (
    <section
      aria-label={t("landing.features.sectionLabel")}
      className="relative flex w-full"
    >
      {/* Left: scrolling feature copy — 4 × 100vh = 400vh scroll runway */}
      <div ref={leftColumnRef} className="w-1/2">
        {FEATURE_KEYS.map((key, index) => {
          const isActive = activeCard === index

          return (
            <div
              key={key}
              className={cn(
                "flex h-screen items-center px-8 transition-opacity duration-300 md:px-12 lg:px-16",
                isActive ? "opacity-100" : "opacity-30",
              )}
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
          )
        })}
      </div>

      {/* Right: sticky visual plane — color tracks activeCard */}
      <div
        className={cn(
          "sticky top-0 flex h-screen w-1/2 items-center justify-center transition-colors duration-300",
          ACTIVE_PANEL_COLORS[activeCard],
        )}
      >
        <p className="text-sm font-medium text-white/90">
          {t("landing.features.animationPlaceholder")} · {activeCard + 1}/
          {FEATURE_KEYS.length}
        </p>
      </div>
    </section>
  )
}
