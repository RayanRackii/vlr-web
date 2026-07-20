import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion"
import { Building2, Boxes, Factory, Lock, Network, Puzzle } from "lucide-react"
import { useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  MASTER_STAGE_ID,
  scrollToMasterChapter,
} from "@/features/landing/components/masterScrollNav"
import { StepOneGraphic } from "@/features/landing/components/StepOneGraphic"
import { StepThreeAuditGraphic } from "@/features/landing/components/StepThreeAuditGraphic"
import { StepTwoRolesGraphic } from "@/features/landing/components/StepTwoRolesGraphic"
import {
  getStoryParagraphOpacityKeys,
  getStoryParagraphWindows,
} from "@/features/landing/components/StoryStep"
import { cn } from "@/lib/utils"

type ChapterConfig = {
  id: string
  eyebrow: string
  stepLabel: string | null
  headline: string
  paragraphs: readonly string[]
  visual: (
    localProgress: MotionValue<number>,
    reducedMotion: boolean,
  ) => ReactNode
}

export function MasterScrollStage() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = Boolean(prefersReducedMotion)
  const [activeIndex, setActiveIndex] = useState(0)

  const chapters = useMemo<ChapterConfig[]>(
    () => [
      {
        id: "features",
        eyebrow: t("landing.header.nav.features"),
        stepLabel: t("landing.features.tempo1.eyebrow"),
        headline: t("landing.features.tempo1.title"),
        paragraphs: [
          t("landing.features.tempo1.description"),
          t("landing.features.tempo1.description2"),
          t("landing.features.tempo1.description3"),
        ],
        visual: (localProgress, rm) => (
          <StepOneGraphic
            progress={localProgress}
            windows={getStoryParagraphWindows(3)}
            reducedMotion={rm}
          />
        ),
      },
      {
        id: "passo2",
        eyebrow: t("landing.header.nav.features"),
        stepLabel: t("landing.features.tempo2.eyebrow"),
        headline: t("landing.features.tempo2.title"),
        paragraphs: [
          t("landing.features.tempo2.description"),
          t("landing.features.tempo2.description2"),
          t("landing.features.tempo2.description3"),
        ],
        visual: (localProgress, rm) => (
          <StepTwoRolesGraphic
            progress={localProgress}
            windows={getStoryParagraphWindows(3)}
            reducedMotion={rm}
          />
        ),
      },
      {
        id: "passo3",
        eyebrow: t("landing.header.nav.features"),
        stepLabel: t("landing.features.tempo3.eyebrow"),
        headline: t("landing.features.tempo3.title"),
        paragraphs: [
          t("landing.features.tempo3.description"),
          t("landing.features.tempo3.description2"),
          t("landing.features.tempo3.description3"),
        ],
        visual: (localProgress, rm) => (
          <StepThreeAuditGraphic
            progress={localProgress}
            windows={getStoryParagraphWindows(3)}
            reducedMotion={rm}
          />
        ),
      },
      {
        id: "solutions",
        eyebrow: t("landing.header.nav.solutions"),
        stepLabel: null,
        headline: t("landing.solutions.title"),
        paragraphs: [t("landing.solutions.subtitle")],
        visual: () => <SegmentCards />,
      },
      {
        id: "platform",
        eyebrow: t("landing.header.nav.platform"),
        stepLabel: null,
        headline: t("landing.platform.title"),
        paragraphs: [t("landing.platform.subtitle")],
        visual: () => <TrustCards />,
      },
    ],
    [t],
  )

  const n = chapters.length

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(n - 1, Math.max(0, Math.floor(latest * n)))
    setActiveIndex((current) => (current === next ? current : next))
  })

  return (
    <section
      id={MASTER_STAGE_ID}
      ref={containerRef}
      className="relative w-full bg-background"
      style={{ height: `${n * 100}vh` }}
      aria-label={t("landing.features.sectionLabel")}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        {chapters.map((chapter, index) => (
          <ChapterPanel
            key={chapter.id}
            index={index}
            count={n}
            progress={scrollYProgress}
            reducedMotion={reducedMotion}
            isActive={activeIndex === index}
            chapter={chapter}
          />
        ))}

        <ChapterProgressDots
          count={n}
          activeIndex={activeIndex}
          onSelect={scrollToMasterChapter}
        />
      </div>
    </section>
  )
}

function ChapterPanel({
  index,
  count,
  progress,
  reducedMotion,
  isActive,
  chapter,
}: {
  index: number
  count: number
  progress: MotionValue<number>
  reducedMotion: boolean
  isActive: boolean
  chapter: ChapterConfig
}) {
  const start = index / count
  const end = (index + 1) / count
  const fade = 0.04

  // Matemática estrita por índice — evita todos os capítulos em opacity 1.
  const inputPoints =
    index === 0
      ? [0, end - fade, end]
      : index === count - 1
        ? [start, start + fade, 1]
        : [start - fade, start, end - fade, end]

  const opacityPoints =
    index === 0 ? [1, 1, 0] : index === count - 1 ? [0, 1, 1] : [0, 1, 1, 0]

  const opacity = useTransform(progress, inputPoints, opacityPoints)
  // Y e visibility derivados da própria opacidade (blindagem).
  const y = useTransform(opacity, [0, 1], [40, 0])
  const visibility = useTransform(opacity, (value) =>
    value > 0.01 ? "visible" : "hidden",
  )
  const pointerEvents = useTransform(opacity, (value) =>
    value > 0.5 ? "auto" : "none",
  )

  const localProgress = useTransform(progress, [start, end], [0, 1])
  const windows = useMemo(
    () => getStoryParagraphWindows(chapter.paragraphs.length),
    [chapter.paragraphs.length],
  )

  return (
    <motion.div
      className="absolute inset-0 mx-auto flex h-full w-full max-w-7xl items-center justify-center px-6 md:px-12 lg:px-24"
      style={
        reducedMotion
          ? {
              opacity: isActive ? 1 : 0,
              y: 0,
              visibility: isActive ? "visible" : "hidden",
              pointerEvents: isActive ? "auto" : "none",
            }
          : { opacity, y, visibility, pointerEvents }
      }
      aria-hidden={!isActive}
    >
      <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12">
        <div className="col-span-1 flex flex-col justify-center space-y-6 lg:col-span-5">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">
            {chapter.eyebrow}
            {chapter.stepLabel ? ` · ${chapter.stepLabel}` : ""}
          </p>
          <h2 className="whitespace-pre-line text-balance text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl">
            {chapter.headline}
          </h2>
          <div className="space-y-4 text-lg text-muted-foreground">
            {chapter.paragraphs.map((text, paragraphIndex) => (
              <ChapterParagraph
                key={`${chapter.id}-${paragraphIndex}`}
                text={text}
                progress={localProgress}
                window={windows[paragraphIndex]!}
                isLast={paragraphIndex === chapter.paragraphs.length - 1}
                reducedMotion={reducedMotion}
                highlight={chapter.paragraphs.length > 1}
              />
            ))}
          </div>
        </div>

        <div className="relative col-span-1 flex min-w-0 justify-end lg:col-span-7">
          {chapter.visual(localProgress, reducedMotion)}
        </div>
      </div>
    </motion.div>
  )
}

function ChapterParagraph({
  text,
  progress,
  window,
  isLast,
  reducedMotion,
  highlight,
}: {
  text: string
  progress: MotionValue<number>
  window: ReturnType<typeof getStoryParagraphWindows>[number]
  isLast: boolean
  reducedMotion: boolean
  highlight: boolean
}) {
  const keys = getStoryParagraphOpacityKeys(window, isLast)
  const opacity = useTransform(progress, keys.input, keys.output)

  return (
    <motion.p
      className="text-pretty"
      style={reducedMotion || !highlight ? { opacity: 1 } : { opacity }}
    >
      {text}
    </motion.p>
  )
}

function ChapterProgressDots({
  count,
  activeIndex,
  onSelect,
}: {
  count: number
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div
      className="pointer-events-auto absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 md:flex lg:right-8"
      role="tablist"
      aria-label="Chapter progress"
    >
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          aria-selected={activeIndex === index}
          aria-label={`Chapter ${index + 1}`}
          onClick={() => {
            onSelect(index)
          }}
          className={cn(
            "size-2.5 rounded-full transition-colors",
            activeIndex === index
              ? "bg-foreground"
              : "bg-foreground/25 hover:bg-foreground/50",
          )}
        />
      ))}
    </div>
  )
}

function SegmentCards() {
  const { t } = useTranslation()
  const solutions = [
    { id: "buildings", Icon: Building2 },
    { id: "multiUnit", Icon: Network },
    { id: "industry", Icon: Factory },
  ] as const

  return (
    <div className="grid w-full max-w-xl gap-4">
      {solutions.map(({ id, Icon }) => (
        <a
          key={id}
          href="#pricing"
          className="group flex items-start gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/30"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-primary">
              {t(`landing.solutions.cards.${id}.for`)}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground">
              {t(`landing.solutions.cards.${id}.title`)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(`landing.solutions.cards.${id}.pain`)}
            </p>
          </div>
        </a>
      ))}
    </div>
  )
}

function TrustCards() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pillars = [
    { id: "isolation", Icon: Lock },
    { id: "modular", Icon: Puzzle },
    { id: "solid", Icon: Boxes },
  ] as const

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {pillars.map(({ id, Icon }) => (
          <div
            key={id}
            className="min-w-0 rounded-2xl border border-border bg-background p-4 shadow-sm"
          >
            <span className="mb-3 grid size-9 place-items-center rounded-xl bg-muted">
              <Icon className="size-4 text-foreground" aria-hidden="true" />
            </span>
            <p className="truncate text-sm font-semibold text-foreground">
              {t(`landing.platform.pillars.${id}.title`)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t(`landing.platform.pillars.${id}.body`)}
            </p>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto sm:self-start"
        onClick={() => {
          void navigate("/onboarding")
        }}
      >
        {t("landing.cta.primary")}
      </Button>
    </div>
  )
}
