import { ArrowRight, Building2, Factory, Network } from "lucide-react"
import { useTranslation } from "react-i18next"

type SolutionCard = {
  id: string
  Icon: typeof Building2
}

const SOLUTIONS: SolutionCard[] = [
  { id: "buildings", Icon: Building2 },
  { id: "multiUnit", Icon: Network },
  { id: "industry", Icon: Factory },
]

export function SolutionsSection() {
  const { t } = useTranslation()

  return (
    <section
      id="solutions"
      aria-labelledby="landing-solutions-title"
      className="scroll-mt-16 border-b border-border py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12 lg:px-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t("landing.solutions.eyebrow")}
          </p>
          <h2
            id="landing-solutions-title"
            className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl"
          >
            {t("landing.solutions.title")}
          </h2>
          <p className="mt-5 text-balance text-lg text-muted-foreground">
            {t("landing.solutions.subtitle")}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {SOLUTIONS.map(({ id, Icon }) => (
            <a
              key={id}
              href="#pricing"
              className="group flex flex-col rounded-2xl border border-border bg-background p-6 shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/30"
            >
              <span className="mb-5 grid size-11 place-items-center rounded-xl bg-muted text-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                {t(`landing.solutions.cards.${id}.for`)}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                {t(`landing.solutions.cards.${id}.title`)}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.solutions.cards.${id}.pain`)}
              </p>
              <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                {t(`landing.solutions.cards.${id}.cta`)}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
