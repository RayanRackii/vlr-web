import type { MotionValue } from "framer-motion"
import { motion, useTransform } from "framer-motion"
import { Briefcase, HardHat, LineChart } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { StoryParagraphWindow } from "@/features/landing/components/StoryStep"
import { cn } from "@/lib/utils"

type StepTwoRolesGraphicProps = {
  progress: MotionValue<number>
  windows: StoryParagraphWindow[]
  reducedMotion?: boolean
}

export function StepTwoRolesGraphic({
  progress,
  windows,
  reducedMotion = false,
}: StepTwoRolesGraphicProps) {
  const { t } = useTranslation()

  const roles = [
    {
      window: windows[0]!,
      title: t("landing.features.mockups.stepTwo.technician"),
      detail: t("landing.features.mockups.stepTwo.technicianDetail"),
      Icon: HardHat,
      accent: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
    {
      window: windows[1]!,
      title: t("landing.features.mockups.stepTwo.manager"),
      detail: t("landing.features.mockups.stepTwo.managerDetail"),
      Icon: Briefcase,
      accent: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    },
    {
      window: windows[2]!,
      title: t("landing.features.mockups.stepTwo.director"),
      detail: t("landing.features.mockups.stepTwo.directorDetail"),
      Icon: LineChart,
      accent: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    },
  ] as const

  return (
    <div className="grid w-full max-w-lg gap-4 sm:grid-cols-3 lg:max-w-xl">
      {roles.map(({ window, title, detail, Icon, accent }) => (
        <RoleCard
          key={title}
          progress={progress}
          window={window}
          title={title}
          detail={detail}
          Icon={Icon}
          accent={accent}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  )
}

function RoleCard({
  progress,
  window,
  title,
  detail,
  Icon,
  accent,
  reducedMotion,
}: {
  progress: MotionValue<number>
  window: StoryParagraphWindow
  title: string
  detail: string
  Icon: typeof HardHat
  accent: string
  reducedMotion: boolean
}) {
  const opacity = useTransform(
    progress,
    [window.start, window.peakStart, 1],
    [0, 1, 1],
  )
  const y = useTransform(progress, [window.start, window.peakStart], [18, 0])

  return (
    <motion.div
      className={cn(
        "flex min-h-44 flex-col rounded-2xl border border-border bg-background p-4 shadow-lg",
      )}
      style={reducedMotion ? { opacity: 1 } : { opacity, y }}
    >
      <div className={cn("mb-4 grid size-10 place-items-center rounded-xl", accent)}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-foreground/70">{detail}</p>
    </motion.div>
  )
}
