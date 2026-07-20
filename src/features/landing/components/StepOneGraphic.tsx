import type { MotionValue } from "framer-motion"
import { motion, useSpring, useTransform } from "framer-motion"
import {
  CalendarCheck,
  Droplets,
  MousePointer2,
  ShieldCheck,
  Wind,
  Zap,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  STORY_EXIT_START,
  type StoryParagraphWindow,
} from "@/features/landing/components/StoryStep"

type StepOneGraphicProps = {
  progress: MotionValue<number>
  windows: StoryParagraphWindow[]
  reducedMotion?: boolean
}

export function StepOneGraphic({
  progress,
  windows,
  reducedMotion = false,
}: StepOneGraphicProps) {
  const { t } = useTranslation()
  const pain = windows[0]!
  const mechanism = windows[1]!
  const result = windows[2]!

  // Parágrafo 2 → primeiro ativo; parágrafo 3 → demais + badge (antes do EXIT).
  const assetOneOpacity = useTransform(
    progress,
    [mechanism.start, mechanism.peakStart],
    [0, 1],
  )
  const assetTwoOpacity = useTransform(
    progress,
    [result.start, result.peakStart],
    [0, 1],
  )
  const assetThreeOpacity = useTransform(
    progress,
    [result.peakStart, Math.min(result.peakStart + 0.06, STORY_EXIT_START - 0.08)],
    [0, 1],
  )

  const assetOneY = useTransform(
    progress,
    [mechanism.start, mechanism.peakStart],
    [16, 0],
  )
  const assetTwoY = useTransform(progress, [result.start, result.peakStart], [16, 0])
  const assetThreeY = useTransform(
    progress,
    [result.peakStart, Math.min(result.peakStart + 0.06, STORY_EXIT_START - 0.08)],
    [16, 0],
  )

  const cursorOpacity = useTransform(
    progress,
    [
      mechanism.peakStart,
      mechanism.peakStart + 0.04,
      mechanism.peakEnd,
      result.start,
    ],
    [0, 1, 1, 0],
  )
  const cursorX = useTransform(
    progress,
    [mechanism.peakStart, mechanism.peakEnd],
    [40, -280],
  )
  const cursorY = useTransform(
    progress,
    [mechanism.peakStart, mechanism.peakEnd],
    [20, -120],
  )

  const pmocOpacity = useTransform(
    progress,
    [mechanism.peakEnd - 0.04, result.start],
    [0, 1],
  )
  const pmocScale = useTransform(
    progress,
    [mechanism.peakEnd - 0.04, result.peakStart],
    [0.92, 1],
  )
  // Hide asset labels under the PMOC overlay to prevent text collision.
  const assetsGridOpacity = useTransform(
    pmocOpacity,
    [0, 0.25, 0.55],
    [1, 0.35, 0],
  )
  const firstDataWidth = useTransform(
    progress,
    [result.start, result.peakStart],
    ["0%", "100%"],
  )
  const secondDataWidth = useTransform(
    progress,
    [result.peakStart, Math.min(result.peakEnd, STORY_EXIT_START - 0.06)],
    ["0%", "100%"],
  )

  const systemScale = useSpring(
    useTransform(
      progress,
      [mechanism.peakEnd, result.start, result.peakStart],
      [1, 1.02, 1],
    ),
    { stiffness: 220, damping: 18 },
  )
  const systemGlowOpacity = useTransform(
    progress,
    [mechanism.peakEnd, result.start, result.peakStart],
    [0, 0.55, 0],
  )

  // Badge coroa o parágrafo 3 e completa antes de qualquer fade de saída (0.9).
  const badgeComplete = Math.min(result.peakEnd, STORY_EXIT_START - 0.04)
  const complianceOpacity = useTransform(
    progress,
    [result.peakStart, badgeComplete, 1],
    [0, 1, 1],
  )
  const complianceScaleTarget = useTransform(
    progress,
    [result.peakStart, badgeComplete],
    [0.85, 1],
  )
  const complianceScale = useSpring(complianceScaleTarget, {
    stiffness: 280,
    damping: 14,
    mass: 0.7,
  })
  const glowOpacity = useTransform(
    progress,
    [result.peakStart, badgeComplete, 1],
    [0, 0.75, 0.4],
  )

  // Shell fica sutil no parágrafo 1 (dor), sem itens.
  const shellDim = useTransform(
    progress,
    [pain.start, pain.peakStart, mechanism.start],
    [0.55, 0.7, 1],
  )

  const assetAnimations = reducedMotion
    ? ([
        { opacity: 1, y: 0 },
        { opacity: 1, y: 0 },
        { opacity: 1, y: 0 },
      ] as const)
    : ([
        { opacity: assetOneOpacity, y: assetOneY },
        { opacity: assetTwoOpacity, y: assetTwoY },
        { opacity: assetThreeOpacity, y: assetThreeY },
      ] as const)

  const dataWidths = [firstDataWidth, secondDataWidth] as const

  const assets = [
    {
      label: t("landing.features.mockups.stepOne.assets.airConditioner"),
      location: t("landing.features.mockups.stepOne.locations.reception"),
      Icon: Wind,
      accent: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    },
    {
      label: t("landing.features.mockups.stepOne.assets.generator"),
      location: t("landing.features.mockups.stepOne.locations.engineRoom"),
      Icon: Zap,
      accent: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    },
    {
      label: t("landing.features.mockups.stepOne.assets.hydraulicPump"),
      location: t("landing.features.mockups.stepOne.locations.lowerLevel"),
      Icon: Droplets,
      accent: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    },
  ] as const

  const pmocRows = [
    {
      asset: t("landing.features.mockups.stepOne.pmoc.split"),
      date: t("landing.features.mockups.stepOne.pmoc.dateOne"),
    },
    {
      asset: t("landing.features.mockups.stepOne.pmoc.generator"),
      date: t("landing.features.mockups.stepOne.pmoc.dateTwo"),
    },
  ] as const

  return (
    <div className="relative w-full max-w-[720px] lg:max-w-[780px] lg:translate-x-6 xl:translate-x-10">
      <motion.div
        className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        style={
          reducedMotion
            ? undefined
            : { scale: systemScale, opacity: shellDim }
        }
      >
        <motion.div
          className="pointer-events-none absolute inset-0 z-30 rounded-2xl shadow-[inset_0_0_32px_rgba(52,211,153,0.18)] ring-2 ring-emerald-400 ring-inset"
          style={{ opacity: reducedMotion ? 0 : systemGlowOpacity }}
          aria-hidden="true"
        />
        <div className="flex min-h-[350px]">
          <aside className="flex w-[68px] shrink-0 flex-col items-center gap-3 border-r border-border bg-muted/45 px-2 py-3">
            <div className="mb-2 size-8 rounded-lg bg-foreground/80" />
            <div className="h-8 w-10 rounded-lg bg-foreground/15" />
            <div className="h-8 w-10 rounded-lg bg-muted-foreground/15" />
            <div className="h-8 w-10 rounded-lg bg-muted-foreground/15" />
            <div className="h-8 w-10 rounded-lg bg-muted-foreground/15" />
            <div className="mt-auto h-7 w-7 rounded-full bg-muted-foreground/20" />
          </aside>

          <div className="relative flex min-w-0 flex-1 flex-col">
            <header className="flex h-[58px] items-center justify-between border-b border-border px-4">
              <div className="space-y-1.5">
                <div className="h-2 w-28 rounded-full bg-foreground/20" />
                <div className="h-1.5 w-20 rounded-full bg-muted-foreground/15" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-16 rounded-md bg-muted" />
                <div className="size-7 rounded-full bg-muted-foreground/20" />
              </div>
            </header>

            <motion.div
              className="grid flex-1 grid-cols-1 gap-2.5 p-4 sm:grid-cols-3"
              style={
                reducedMotion ? undefined : { opacity: assetsGridOpacity }
              }
            >
              {assets.map(({ label, location, Icon, accent }, index) => (
                <motion.div
                  key={label}
                  className="flex min-h-28 min-w-0 flex-col rounded-xl border border-border bg-background p-3 shadow-sm"
                  style={assetAnimations[index]}
                >
                  <div
                    className={`mb-3 grid size-8 place-items-center rounded-lg ${accent}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <p className="truncate text-xs font-semibold leading-snug text-foreground">
                    {label}
                  </p>
                  <p className="mt-1 truncate text-[11px] leading-snug text-foreground/65 dark:text-foreground/70">
                    {location}
                  </p>
                  <div className="mt-auto flex items-center gap-1.5 pt-3">
                    <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      {t("landing.features.mockups.stepOne.active")}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {!reducedMotion ? (
              <motion.div
                className="pointer-events-none absolute bottom-5 right-5 z-20 drop-shadow-md"
                style={{ opacity: cursorOpacity, x: cursorX, y: cursorY }}
                aria-hidden="true"
              >
                <MousePointer2 className="size-6 fill-background text-foreground" />
              </motion.div>
            ) : null}

            <motion.div
              className="absolute inset-x-4 top-[88px] bottom-4 z-10 origin-top-left overflow-hidden rounded-xl border border-border bg-background shadow-xl"
              style={
                reducedMotion
                  ? { opacity: 1, scale: 1 }
                  : { opacity: pmocOpacity, scale: pmocScale }
              }
            >
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CalendarCheck
                    className="size-3.5 text-primary"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] font-semibold text-foreground">
                    {t("landing.features.mockups.stepOne.pmoc.title")}
                  </p>
                </div>
                <span className="text-[10px] text-foreground/65">
                  {t("landing.features.mockups.stepOne.pmoc.nextReviews")}
                </span>
              </div>
              <div className="divide-y divide-border">
                {pmocRows.map((row, index) => (
                  <div key={row.asset} className="px-3 py-2.5">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <span className="min-w-0 truncate text-[11px] font-medium text-foreground">
                        {row.asset}
                      </span>
                      <span className="min-w-0 truncate text-center text-[10px] text-foreground/65">
                        {row.date}
                      </span>
                      <span className="justify-self-end truncate rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {t("landing.features.mockups.stepOne.pmoc.scheduled")}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: reducedMotion ? "100%" : dataWidths[index],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="absolute right-3 top-3 z-20"
          style={
            reducedMotion
              ? { opacity: 1, scale: 1 }
              : { opacity: complianceOpacity, scale: complianceScale }
          }
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-400 blur-xl"
            style={{ opacity: reducedMotion ? 0.35 : glowOpacity }}
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-700 shadow-lg shadow-emerald-500/20 backdrop-blur dark:text-emerald-300">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t("landing.features.mockups.stepOne.operational")}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
