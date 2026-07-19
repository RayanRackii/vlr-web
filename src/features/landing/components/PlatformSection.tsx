import { Boxes, Lock, Puzzle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"

const PILLARS = [
  { id: "isolation", Icon: Lock },
  { id: "modular", Icon: Puzzle },
  { id: "solid", Icon: Boxes },
] as const

export function PlatformSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section
      id="platform"
      aria-labelledby="landing-platform-title"
      className="scroll-mt-16 border-b border-border bg-muted/15 py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("landing.platform.eyebrow")}
          </p>
          <h2
            id="landing-platform-title"
            className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl"
          >
            {t("landing.platform.title")}
          </h2>
          <p className="mt-5 text-balance text-lg text-muted-foreground">
            {t("landing.platform.subtitle")}
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {PILLARS.map(({ id, Icon }) => (
            <div key={id} className="rounded-2xl border border-border bg-background p-6">
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-muted">
                <Icon className="size-5 text-foreground" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">
                {t(`landing.platform.pillars.${id}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.platform.pillars.${id}.body`)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Button
            type="button"
            size="lg"
            onClick={() => {
              void navigate("/onboarding")
            }}
          >
            {t("landing.cta.primary")}
          </Button>
        </div>
      </div>
    </section>
  )
}
