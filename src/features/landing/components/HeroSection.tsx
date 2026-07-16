import { ArrowRight } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { HeroParallax } from "@/components/ui/hero-parallax"
import { HERO_PARALLAX_PRODUCT_SEEDS } from "@/features/landing/data/heroParallaxProducts"
import { cn } from "@/lib/utils"

const SOCIAL_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=128&h=128&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80",
] as const

export function HeroSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const products = useMemo(
    () =>
      HERO_PARALLAX_PRODUCT_SEEDS.map((seed) => ({
        title: t(seed.titleKey),
        link: seed.link,
        thumbnail: seed.thumbnail,
      })),
    [t]
  )

  return (
    <section aria-labelledby="landing-hero-title">
      <HeroParallax
        products={products}
        header={
          <div className="relative z-20 flex w-full flex-col items-center justify-center px-4 text-center mt-20 mb-10">
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
              className="max-w-5xl text-balance text-4xl font-extrabold tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {t("landing.hero.titlePrefix")}
              <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                {t("landing.hero.titleHighlight")}
              </span>
            </h1>

            <h2 className="mt-6 max-w-2xl text-balance text-base font-normal text-muted-foreground md:text-lg lg:text-xl">
              {t("landing.hero.subtitle")}
            </h2>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
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
        }
      />
    </section>
  )
}
