import { useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion"
import { useTranslation } from "react-i18next"

import {
  ModulesHubMockup,
  ScaleReadyMockup,
  SmartOpsMockup,
  UnifiedProcessesMockup,
} from "@/features/landing/components/FeatureUiMockups"
import { cn } from "@/lib/utils"

const FEATURE_KEYS = ["tempo1", "tempo2", "tempo3", "tempo4"] as const

const FEATURE_MOCKUPS = [
  ModulesHubMockup,
  UnifiedProcessesMockup,
  SmartOpsMockup,
  ScaleReadyMockup,
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

  const ActiveMockup = FEATURE_MOCKUPS[activeCard]

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

      {/* Right: sticky visual plane — system UI mockups cross-fade */}
      <div className="sticky top-0 flex h-screen w-1/2 items-center justify-center bg-muted/40 px-6 md:px-10">
        <div className="relative flex h-full w-full max-w-lg items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCard}
              className="w-full"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <ActiveMockup />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
