import { ArrowRight } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  ModuleMockupCard,
  type ModuleMockupType,
} from "@/features/landing/components/ModuleMockupCard"
import { cn } from "@/lib/utils"

const SOCIAL_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80",
] as const

const MARQUEE_MODULES = [
  { type: "rh", productKey: "hr" },
  { type: "financeiro", productKey: "finance" },
  { type: "pmoc", productKey: "pmoc" },
  { type: "os", productKey: "workOrder" },
  { type: "inventario", productKey: "inventory" },
  { type: "aluguel", productKey: "rentals" },
] as const

const FLOATING_CARDS = [
  {
    type: "pmoc",
    moduleKey: "pmoc",
    className: "top-16 left-4 hidden -rotate-6 md:block md:left-10",
    duration: 4,
  },
  {
    type: "inventario",
    moduleKey: "inventory",
    className: "bottom-20 left-2 hidden rotate-12 md:block md:left-5",
    duration: 5.2,
  },
  {
    type: "financeiro",
    moduleKey: "finance",
    className: "top-24 right-4 hidden -rotate-3 md:block md:right-12",
    duration: 4.6,
  },
  {
    type: "aluguel",
    moduleKey: "rentals",
    className: "bottom-16 right-3 hidden rotate-6 md:block md:right-8",
    duration: 5.8,
  },
  {
    type: "os",
    moduleKey: "workOrder",
    className: "top-[42%] -left-16 hidden -rotate-12 xl:block",
    duration: 6.2,
  },
  {
    type: "rh",
    moduleKey: "hr",
    className: "top-[38%] -right-16 hidden rotate-6 xl:block",
    duration: 5,
  },
] as const satisfies readonly {
  type: ModuleMockupType
  moduleKey: string
  className: string
  duration: number
}[]

type MarqueeModule = {
  type: ModuleMockupType
  title: string
}

function HeroModuleMarquee({ modules }: { modules: MarqueeModule[] }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      className="pointer-events-none absolute left-0 top-1/2 z-0 w-full -translate-y-1/2 overflow-hidden opacity-60"
      aria-hidden="true"
    >
      <div
        className={cn(
          "flex w-max will-change-transform",
          !prefersReducedMotion && "animate-marquee-right motion-reduce:animate-none"
        )}
      >
        {[0, 1].map((copyIndex) => (
          <div
            key={copyIndex}
            className="flex shrink-0 gap-6 pr-6"
          >
            {modules.map((module) => (
              <ModuleMockupCard
                key={`${copyIndex}-${module.type}`}
                type={module.type}
                title={module.title}
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
  className,
  duration,
}: {
  type: ModuleMockupType
  title: string
  className: string
  duration: number
}) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn("absolute z-10", className)}
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
        className="scale-90 md:scale-100"
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
    [t]
  )

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative min-h-[calc(100vh-4rem)] w-full overflow-hidden"
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
          className={card.className}
          duration={card.duration}
        />
      ))}

      <div className="absolute left-1/2 top-1/2 z-20 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 px-4 text-center">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[30rem] w-[min(100%,48rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/75 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex items-center pl-2">
              {SOCIAL_AVATARS.map((src, index) => (
                <Avatar
                  key={src}
                  className={cn(
                    "size-8 border-2 border-background",
                    index > 0 && "-ml-2"
                  )}
                >
                  <AvatarImage src={src} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {String.fromCharCode(65 + index)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("landing.hero.socialProof")}
            </p>
          </div>

          <h1
            id="landing-hero-title"
            className="max-w-5xl text-balance text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl"
          >
            {t("landing.hero.titlePrefix")}
            <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              {t("landing.hero.titleHighlight")}
            </span>
          </h1>

          <h2 className="mt-8 max-w-3xl text-balance text-base font-normal leading-relaxed text-muted-foreground md:text-xl lg:text-2xl">
            {t("landing.hero.subtitle")}
          </h2>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:gap-4">
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
      </div>
    </section>
  )
}
