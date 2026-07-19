import { ArrowRight } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  ModuleMockupCard,
  type ModuleMockupType,
} from "@/features/landing/components/ModuleMockupCard"
import { cn } from "@/lib/utils"

const MARQUEE_MODULES = [
  { type: "pmoc", productKey: "pmoc" },
  { type: "os", productKey: "workOrder" },
  { type: "inventario", productKey: "inventory" },
  { type: "aluguel", productKey: "rentals" },
  { type: "rh", productKey: "hr" },
  { type: "financeiro", productKey: "finance" },
] as const

const FLOATING_CARDS = [
  {
    type: "pmoc",
    moduleKey: "pmoc",
    positionClassName: "top-[12%] left-[8%] hidden lg:block xl:left-[10%]",
    cardClassName: "-rotate-12",
    duration: 4,
  },
  {
    type: "inventario",
    moduleKey: "inventory",
    positionClassName:
      "bottom-[22%] left-[10%] hidden lg:block xl:bottom-[24%] xl:left-[14%]",
    cardClassName: "-rotate-6",
    duration: 5.2,
  },
  {
    type: "os",
    moduleKey: "workOrder",
    positionClassName: "top-[14%] right-[8%] hidden lg:block xl:right-[10%]",
    cardClassName: "rotate-6",
    duration: 4.6,
  },
  {
    type: "aluguel",
    moduleKey: "rentals",
    positionClassName:
      "bottom-[22%] right-[10%] hidden lg:block xl:bottom-[24%] xl:right-[14%]",
    cardClassName: "rotate-12",
    duration: 5.8,
  },
] as const satisfies readonly {
  type: ModuleMockupType
  moduleKey: string
  positionClassName: string
  cardClassName: string
  duration: number
}[]

const MARQUEE_EDGE_FADE =
  "linear-gradient(to right, transparent, black 10%, black 90%, transparent)"

type MarqueeModule = {
  type: ModuleMockupType
  title: string
}

function HeroModuleMarquee({ modules }: { modules: MarqueeModule[] }) {
  const prefersReducedMotion = useReducedMotion()
  const repeatedModules = [...modules, ...modules, ...modules]

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,2vh)] z-0 overflow-hidden max-lg:opacity-40 lg:opacity-55"
      style={{
        maskImage: MARQUEE_EDGE_FADE,
        WebkitMaskImage: MARQUEE_EDGE_FADE,
      }}
      aria-hidden="true"
    >
      <div
        className={cn(
          "flex w-max will-change-transform",
          !prefersReducedMotion &&
            "animate-marquee-right motion-reduce:animate-none",
        )}
      >
        {[0, 1].map((copyIndex) => (
          <div key={copyIndex} className="flex shrink-0 gap-6 pr-6">
            {repeatedModules.map((module, moduleIndex) => (
              <ModuleMockupCard
                key={`${copyIndex}-${module.type}-${moduleIndex}`}
                type={module.type}
                title={module.title}
                className="scale-[0.85] sm:scale-90 lg:scale-95"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function FloatingModuleCard({
  type,
  title,
  positionClassName,
  cardClassName,
  duration,
}: {
  type: ModuleMockupType
  title: string
  positionClassName: string
  cardClassName: string
  duration: number
}) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn("pointer-events-none absolute z-10", positionClassName)}
      animate={prefersReducedMotion ? undefined : { y: [0, -15, 0] }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <ModuleMockupCard
        type={type}
        title={title}
        className={cn("scale-90", cardClassName)}
      />
    </motion.div>
  )
}

export function HeroSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const marqueeModules = useMemo(
    () =>
      MARQUEE_MODULES.map((module) => ({
        type: module.type,
        title: t(`landing.hero.products.${module.productKey}`),
      })),
    [t],
  )

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative flex min-h-[calc(100vh-4rem)] w-full flex-col overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,hsl(var(--primary)/0.08),transparent)]"
        aria-hidden="true"
      />

      <HeroModuleMarquee modules={marqueeModules} />

      {FLOATING_CARDS.map((card) => (
        <FloatingModuleCard
          key={card.moduleKey}
          type={card.type}
          title={t(`landing.hero.products.${card.moduleKey}`)}
          positionClassName={card.positionClassName}
          cardClassName={card.cardClassName}
          duration={card.duration}
        />
      ))}

      <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-[clamp(7.5rem,20vh,13rem)] pt-[clamp(2rem,6vh,4.5rem)] text-center">
        <div className="relative isolate z-30 flex w-full flex-col items-center">
          <div
            className="pointer-events-none absolute inset-0 z-[-1] scale-150 rounded-full bg-background/90 blur-[80px]"
            aria-hidden="true"
          />

          <p className="mb-5 text-[13px] leading-snug text-muted-foreground md:text-sm">
            {t("landing.hero.eyebrow")}
          </p>

          <h1
            id="landing-hero-title"
            className="max-w-5xl text-balance text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
          >
            {t("landing.hero.titlePrefix")}
            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent">
              {t("landing.hero.titleHighlight")}
            </span>
          </h1>

          <h2 className="mt-6 max-w-3xl text-balance text-base font-normal leading-relaxed text-muted-foreground md:mt-8 md:text-xl lg:text-2xl">
            {t("landing.hero.subtitle")}
          </h2>

          <div className="mt-8 flex flex-col items-center gap-2 sm:mt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  void navigate("/onboarding")
                }}
              >
              {t("landing.cta.primary")}
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              render={<a href="#contact" />}
            >
              {t("landing.cta.secondary")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("landing.cta.microcopy")}
          </p>
          </div>
        </div>
      </div>
    </section>
  )
}
