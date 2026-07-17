import { useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion"
import { useTranslation } from "react-i18next"

import {
  ScaleReadyMockup,
  SmartOpsMockup,
  UnifiedProcessesMockup,
} from "@/features/landing/components/FeatureUiMockups"
import { StepOneGraphic } from "@/features/landing/components/StepOneGraphic"
import { cn } from "@/lib/utils"

const FEATURE_KEYS = ["tempo1", "tempo2", "tempo3", "tempo4"] as const
const FEATURE_COUNT = FEATURE_KEYS.length

/** Âncoras alinhadas aos 4 tempos do scrollytelling (header → seções). */
const FEATURE_SECTION_IDS = [
  "features",
  "solutions",
  "platform",
  "pricing",
] as const

export function FeatureScrollReveal() {
  const { t } = useTranslation()
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const [activeCard, setActiveCard] = useState(0)

  const { scrollYProgress } = useScroll({
    target: leftColumnRef,
    offset: ["start start", "end end"],
  })

  /**
   * Progresso 0→1 apenas dentro do card ativo.
   * Ex.: global 0.125 (meio do 1º quarto) → local 0.5
   */
  const localProgress = useTransform(scrollYProgress, (latest) => {
    const clamped = Math.min(Math.max(latest, 0), 0.999999)
    return (clamped * FEATURE_COUNT) % 1
  })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextCard = Math.min(
      FEATURE_COUNT - 1,
      Math.floor(latest * FEATURE_COUNT),
    )

    setActiveCard((current) => (current === nextCard ? current : nextCard))
  })

  return (
    <section
      aria-label={t("landing.features.sectionLabel")}
      className="relative w-full overflow-hidden"
    >
      <div className="mx-auto flex w-full max-w-7xl px-6 md:px-12 lg:px-24">
        <div ref={leftColumnRef} className="w-[40%]">
          {FEATURE_KEYS.map((key, index) => {
            const isActive = activeCard === index
            const sectionId = FEATURE_SECTION_IDS[index]

            return (
              <div
                key={key}
                id={sectionId}
                className={cn(
                  "flex h-screen scroll-mt-16 items-center bg-gradient-to-br from-primary/[0.04] via-background to-background transition-opacity duration-300",
                  isActive ? "opacity-100" : "opacity-30",
                )}
              >
                <div className="w-full max-w-xl pr-8">
                  {index !== 0 ? (
                    <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`landing.features.${key}.eyebrow`)}
                    </p>
                  ) : null}
                  <h2
                    className={cn(
                      "text-balance text-4xl font-bold tracking-tight text-foreground lg:text-5xl",
                      index === 0 ? "mb-6" : "mb-4",
                    )}
                  >
                    {t(`landing.features.${key}.title`)}
                  </h2>
                  <div
                    className={cn(
                      "max-w-xl font-normal text-muted-foreground",
                      index === 0
                        ? "text-lg leading-relaxed [&>p]:mb-6"
                        : "text-base leading-relaxed md:text-lg",
                    )}
                  >
                    <p>{t(`landing.features.${key}.description`)}</p>
                    {index === 0 ? (
                      <>
                        <p>{t("landing.features.tempo1.description2")}</p>
                        <p>{t("landing.features.tempo1.description3")}</p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="sticky top-0 flex h-screen w-[60%] items-center">
          <div
            className={cn(
              "relative flex w-full items-center",
              activeCard === 0 ? "justify-end" : "justify-center",
            )}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCard}
                  className={cn(
                  "w-full",
                  activeCard === 0
                    ? "relative flex items-center justify-end"
                    : "max-w-xl",
                  )}
                initial={
                  activeCard === 0
                    ? false
                    : { opacity: 0, y: 20, scale: 0.95 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeCard === 0 ? (
                  <StepOneGraphic localProgress={localProgress} />
                ) : null}
                {activeCard === 1 ? <UnifiedProcessesMockup /> : null}
                {activeCard === 2 ? <SmartOpsMockup /> : null}
                {activeCard === 3 ? <ScaleReadyMockup /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
