import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  LayoutGrid,
  LayoutPanelLeft,
  Lightbulb,
  Map as MapIcon,
  Monitor,
  PlayCircle,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Tag,
  Users,
  Volume2,
  VolumeX,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import { playGuideRewardSound } from "./guideSound"
import type { GuideDemo, GuideIconName, GuideLesson, GuideStep, ModuleGuideConfig } from "./types"
import { useGuideProgress } from "./useGuideProgress"
import { usePrefersReducedMotion } from "./usePrefersReducedMotion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { iconProps } from "@/lib/icon"
import { cn } from "@/lib/utils"

type GuideTarget = { to: string; labelKey: string }

type ModuleGuideProps = {
  config: ModuleGuideConfig
  titleKey: string
  summaryKey: string
  icon: LucideIcon
  shortcuts: readonly GuideTarget[]
  related: readonly GuideTarget[]
  userId: string | null | undefined
  tenantId: string | null | undefined
}

/** Name → icon map so config/locale data never imports icon components. */
const GUIDE_ICONS: Record<GuideIconName, LucideIcon> = {
  resource: LayoutPanelLeft,
  hours: Clock,
  connect: Workflow,
  screen: Monitor,
  compass: Compass,
  equipment: Wrench,
  plan: ClipboardList,
  order: FileText,
  calendar: CalendarDays,
  eye: Eye,
  tag: Tag,
  map: MapIcon,
  grid: LayoutGrid,
  users: Users,
  cart: ShoppingCart,
  wrench: Wrench,
  book: BookOpen,
  sliders: SlidersHorizontal,
  check: CheckCircle2,
}

function GuideIcon({ name, className }: { name: GuideIconName; className?: string }) {
  const Icon = GUIDE_ICONS[name]
  return <Icon {...iconProps()} className={className} />
}

/** Resolve the real screen a step points at, so "Go to screen" / "See it in practice" can navigate. */
function stepTarget(
  step: GuideStep,
  learnIndex: number,
  shortcuts: readonly GuideTarget[],
  related: readonly GuideTarget[],
): GuideTarget | undefined {
  if (step.kind === "exploreRelated") return related[0]
  if (step.kind === "visitShortcut") return shortcuts[0]
  if (shortcuts.length === 0) return undefined
  return shortcuts[Math.min(learnIndex, shortcuts.length - 1)]
}

export function ModuleGuide({
  config,
  titleKey,
  summaryKey,
  icon: Icon,
  shortcuts,
  related,
  userId,
  tenantId,
}: ModuleGuideProps) {
  const { t } = useTranslation()
  const reducedMotion = usePrefersReducedMotion()
  const progress = useGuideProgress(tenantId, userId, config.key, config.steps)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)
  const [reward, setReward] = useState<{ step: GuideStep; allDone: boolean } | null>(null)
  const justCompletedTimer = useRef<number | undefined>(undefined)
  const rewardTimer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(justCompletedTimer.current)
      window.clearTimeout(rewardTimer.current)
    },
    [],
  )

  const steps = config.steps
  const firstIncomplete = steps.find((step) => !progress.isStepDone(step.id))
  const selected = selectedId ? steps.find((step) => step.id === selectedId) : undefined
  const activeStep = firstIncomplete
  const lessonStep = selected && !progress.isStepDone(selected.id) ? selected : activeStep
  const allDone = !firstIncomplete
  const activeIndex = activeStep ? steps.indexOf(activeStep) : steps.length

  const moduleTitle = t(titleKey)

  function markStepDone(step: GuideStep) {
    if (step.id !== firstIncomplete?.id || progress.isStepDone(step.id)) return
    progress.completeStep(step.id)
    if (progress.soundOn) playGuideRewardSound()
    setSelectedId(null)

    setJustCompletedId(step.id)
    window.clearTimeout(justCompletedTimer.current)
    justCompletedTimer.current = window.setTimeout(() => setJustCompletedId(null), reducedMotion ? 0 : 650)

    const completedNow = progress.completedCount + 1
    const nowAllDone = completedNow >= steps.length
    setReward({ step, allDone: nowAllDone })
    window.clearTimeout(rewardTimer.current)
    rewardTimer.current = window.setTimeout(() => setReward(null), 4200)
  }

  function handleReset() {
    progress.reset()
    setSelectedId(null)
    setReward(null)
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon {...iconProps("md")} />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{moduleTitle}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(summaryKey)}</p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-0 p-0">
          {/* Header: title + progress ring + sound toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 sm:px-6">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <SlidersHorizontal {...iconProps()} className="size-4 text-muted-foreground" />
              {t("moduleGuide.roadmapTitle")}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <ProgressRing completed={progress.completedCount} total={progress.totalSteps} />
                <span>
                  <span className="text-foreground tabular-nums">{progress.completedCount}</span>{" "}
                  {t("moduleGuide.progressShort", { total: progress.totalSteps })}
                </span>
              </div>
              <label className="flex min-h-11 items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                {progress.soundOn ? (
                  <Volume2 {...iconProps()} className="size-4" />
                ) : (
                  <VolumeX {...iconProps()} className="size-4" />
                )}
                <span>{t("moduleGuide.soundLabel")}</span>
                <Switch
                  size="sm"
                  data-testid="guide-sound-toggle"
                  checked={progress.soundOn}
                  onCheckedChange={() => progress.toggleSound()}
                  aria-label={t("moduleGuide.soundToggle")}
                />
              </label>
            </div>
          </div>

          {/* Connected roadmap */}
          <nav className="px-5 pt-6 pb-2 sm:px-7">
            <ol aria-label={t("moduleGuide.roadmapTitle")} className="flex flex-col gap-4 md:flex-row md:items-start md:gap-1.5">
              {steps.map((step, index) => {
                const done = progress.isStepDone(step.id)
                const isActive = !allDone && activeStep?.id === step.id
                const state = done ? "done" : isActive ? "active" : "todo"
                const connectorFilled = index < activeIndex
                return (
                  <li
                    key={step.id}
                    aria-current={isActive ? "step" : undefined}
                    data-state={state}
                    className="relative flex flex-1"
                  >
                    {index < steps.length - 1 ? (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-1/2 top-5 z-0 hidden h-[3px] w-full rounded-full md:block",
                            connectorFilled ? "bg-success" : "bg-muted",
                          )}
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-5 top-1/2 z-0 block h-full w-[3px] -translate-x-1/2 rounded-full md:hidden",
                            connectorFilled ? "bg-success" : "bg-muted",
                          )}
                        />
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedId(step.id)}
                      aria-label={t("moduleGuide.roadmap.stepLabel", {
                        index: index + 1,
                        total: steps.length,
                        title: t(step.titleKey),
                        state: t(`moduleGuide.roadmap.state.${state}`),
                      })}
                      className={cn(
                        "group flex min-h-11 w-full items-center gap-3 rounded-xl text-left outline-none",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "md:flex-col md:items-center md:gap-2 md:py-1 md:text-center",
                      )}
                    >
                      <span
                        className={cn(
                          "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-[2.5px] bg-card text-sm font-bold tabular-nums transition-transform duration-200 ease-out",
                          state === "todo" && "border-input text-muted-foreground",
                          state === "active" && "border-primary bg-primary/10 text-primary",
                          state === "done" &&
                            "border-success bg-success text-success-foreground",
                          isActive && !reducedMotion && "scale-110",
                          justCompletedId === step.id && !reducedMotion && "scale-110",
                        )}
                      >
                        {done ? <Check className="size-5" aria-hidden /> : index + 1}
                      </span>
                      <span className="min-w-0 md:max-w-[9rem]">
                        <span
                          className={cn(
                            "block text-[0.8rem] font-semibold leading-tight",
                            state === "todo" && "font-medium text-muted-foreground",
                            state === "active" && "text-primary",
                            state === "done" && "text-foreground",
                          )}
                        >
                          {t(step.titleKey)}
                        </span>
                        {step.shortKey ? (
                          <span className="mt-0.5 block text-[0.7rem] leading-tight text-muted-foreground">
                            {t(step.shortKey)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>

          {/* Next best action */}
          <div className="px-5 pt-3 sm:px-6">
            {activeStep ? (
              <NextAction
                step={activeStep}
                target={stepTarget(activeStep, Math.min(activeIndex, 2), shortcuts, related)}
                onMarkDone={markStepDone}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-success/30 bg-success/10 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-success shadow-sm">
                  <CheckCircle2 {...iconProps("sm")} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wide text-success">
                    {t("moduleGuide.nextAction.allDone")}
                  </p>
                  <p className="text-sm font-medium">{t("moduleGuide.nextAction.allDoneDescription")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw aria-hidden />
                  {t("moduleGuide.replay")}
                </Button>
              </div>
            )}
          </div>

          {/* Per-step reward */}
          {reward ? (
            <div className="px-5 pt-3 sm:px-6">
              <div
                role="status"
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-3",
                  !reducedMotion && "animate-in fade-in slide-in-from-top-1",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground",
                    !reducedMotion && "animate-in zoom-in",
                  )}
                >
                  <Check className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("moduleGuide.reward.title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {reward.allDone
                      ? t("moduleGuide.reward.allDone")
                      : t("moduleGuide.reward.stepProgress", {
                          completed: progress.completedCount,
                          total: progress.totalSteps,
                        })}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Mini-lesson */}
          <div className="p-3 sm:p-4">
            {lessonStep ? (
              <LessonPanel
                lesson={lessonStep.lesson}
                target={stepTarget(lessonStep, Math.min(steps.indexOf(lessonStep), 2), shortcuts, related)}
              />
            ) : (
              <div className="rounded-xl border border-border bg-secondary p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary">
                    <Check className="size-3.5" aria-hidden />
                    {t("moduleGuide.lesson.allDoneChip")}
                  </span>
                  <p className="text-sm font-semibold">{t("moduleGuide.lesson.allDoneHeadline", { module: moduleTitle })}</p>
                </div>
                <p className="text-[0.85rem] leading-relaxed text-foreground">{t("moduleGuide.lesson.allDoneBody")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw aria-hidden />
          {t("moduleGuide.reset")}
        </Button>
      </div>
    </div>
  )
}

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const radius = 9
  const circumference = 2 * Math.PI * radius
  const fraction = total > 0 ? completed / total : 0
  return (
    <svg viewBox="0 0 24 24" className="size-[22px] -rotate-90" aria-hidden>
      <circle cx="12" cy="12" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="var(--success)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  )
}

function NextAction({
  step,
  target,
  onMarkDone,
}: {
  step: GuideStep
  target: GuideTarget | undefined
  onMarkDone: (step: GuideStep) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
        <GuideIcon name={step.icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-primary">
          {t("moduleGuide.nextAction.eyebrow")}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-[0.95rem] font-semibold">
          {t(step.titleKey)}
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {t("moduleGuide.timeEstimate", { minutes: step.estMinutes })}
          </span>
        </p>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        {target ? (
          <Button variant="outline" className="flex-1 sm:flex-none" render={<Link to={target.to} />}>
            <ExternalLink aria-hidden />
            {t("moduleGuide.nextAction.goToScreen")}
          </Button>
        ) : null}
        <Button data-testid="guide-mark-done" className="flex-1 sm:flex-none" onClick={() => onMarkDone(step)}>
          <Check aria-hidden />
          {t("moduleGuide.markDone")}
        </Button>
      </div>
    </div>
  )
}

function LessonPanel({ lesson, target }: { lesson: GuideLesson; target: GuideTarget | undefined }) {
  const { t } = useTranslation()
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-secondary" aria-label={t("moduleGuide.lesson.chip")}>
      <div className="flex flex-wrap items-center gap-2.5 px-4 pt-4 sm:px-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-primary">
          <BookOpen className="size-3.5" aria-hidden />
          {t("moduleGuide.lesson.chip")}
        </span>
        <p className="text-[0.9rem] font-semibold">{t(lesson.headlineKey)}</p>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
        <Diagram lesson={lesson} />

        <p className="text-[0.85rem] leading-relaxed text-foreground">{t(lesson.explanationKey)}</p>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="size-4 text-primary" aria-hidden />
            {t("moduleGuide.lesson.whyTitle")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {lesson.whyItMattersKeys.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-[0.82rem] leading-snug text-foreground">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        {lesson.demo ? <DemoView demo={lesson.demo} /> : null}
      </div>

      {target ? (
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4 sm:px-5">
          <Button variant="outline" size="sm" render={<Link to={target.to} />}>
            <PlayCircle aria-hidden />
            {t("moduleGuide.lesson.seeInPractice")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("moduleGuide.lesson.opens", { target: t(target.labelKey) })}</span>
        </div>
      ) : null}
    </section>
  )
}

function Diagram({ lesson }: { lesson: GuideLesson }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0 overflow-x-auto rounded-xl border border-border bg-card p-4 md:flex-row md:items-stretch">
      {lesson.diagram.map((node, index) => (
        <div key={node.titleKey} className="flex flex-1 items-stretch md:flex-col">
          <div className="flex flex-1 items-center gap-3 py-2 md:flex-col md:items-center md:py-0 md:text-center">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                index === lesson.diagram.length - 1
                  ? "border-success/25 bg-success/10 text-success"
                  : "border-primary/20 bg-primary/10 text-primary",
              )}
            >
              <GuideIcon name={node.icon} className="size-5" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.78rem] font-semibold leading-tight">{t(node.titleKey)}</span>
              <span className="text-[0.7rem] leading-tight text-muted-foreground">{t(node.captionKey)}</span>
            </span>
          </div>
          {index < lesson.diagram.length - 1 ? (
            <span className="flex shrink-0 items-center justify-center pl-5 text-muted-foreground/40 md:px-1 md:pt-2.5 md:pl-0" aria-hidden>
              <ArrowRight className="size-5 rotate-90 md:rotate-0" />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function DemoView({ demo }: { demo: GuideDemo }) {
  switch (demo.kind) {
    case "weeklyHours":
      return <WeeklyHoursDemo />
    case "maintenanceFreq":
      return <MaintenanceFreqDemo />
    case "resourcePreview":
      return <ResourcePreviewDemo demo={demo} />
    case "connections":
      return <ConnectionsDemo demo={demo} />
    case "screenPreview":
      return <ScreenPreviewDemo demo={demo} />
    default:
      return null
  }
}

function DemoShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground">
        <SlidersHorizontal className="size-4" aria-hidden />
        {title}
      </div>
      {children}
    </div>
  )
}

const MORNING_SLOTS = ["08:00", "09:00", "10:00", "11:00"] as const
const AFTERNOON_SLOTS = ["14:00", "15:00", "16:00", "17:00"] as const

function WeeklyHoursDemo() {
  const { t } = useTranslation()
  const dayNames = t("moduleGuide.demo.weekly.days", { returnObjects: true }) as unknown as string[]
  const [openDays, setOpenDays] = useState<boolean[]>([true, true, true, true, true, false, false])
  const [windows, setWindows] = useState({ morning: true, afternoon: true })

  const activeSlots = [...(windows.morning ? MORNING_SLOTS : []), ...(windows.afternoon ? AFTERNOON_SLOTS : [])]
  const openIndexes = openDays.map((open, index) => (open ? index : -1)).filter((index) => index >= 0)
  const total = openIndexes.length * activeSlots.length

  return (
    <DemoShell title={t("moduleGuide.demo.weekly.title")}>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b border-border p-4 md:border-r md:border-b-0">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {t("moduleGuide.demo.weekly.resourceHours")}
          </p>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {dayNames.map((day, index) => (
              <button
                key={day}
                type="button"
                aria-pressed={openDays[index]}
                onClick={() => setOpenDays((prev) => prev.map((open, i) => (i === index ? !open : open)))}
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
                  openDays[index]
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-muted-foreground",
                )}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {(["morning", "afternoon"] as const).map((key) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <span className="flex flex-col">
                  <span className="text-[0.78rem] font-semibold">{t(`moduleGuide.demo.weekly.${key}.label`)}</span>
                  <span className="text-[0.7rem] text-muted-foreground">{t(`moduleGuide.demo.weekly.${key}.range`)}</span>
                </span>
                <Switch
                  size="sm"
                  checked={windows[key]}
                  onCheckedChange={() => setWindows((prev) => ({ ...prev, [key]: !prev[key] }))}
                  aria-label={t(`moduleGuide.demo.weekly.${key}.label`)}
                />
              </label>
            ))}
          </div>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {t("moduleGuide.demo.weekly.customerView")}
          </p>
          {openIndexes.length === 0 || activeSlots.length === 0 ? (
            <p className="rounded-lg py-3 text-center text-[0.8rem] text-muted-foreground">
              {t("moduleGuide.demo.weekly.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {openIndexes.map((dayIndex) => (
                <div
                  key={dayIndex}
                  className="flex items-center justify-between gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <span className="w-9 shrink-0 text-[0.78rem] font-semibold">{dayNames[dayIndex]}</span>
                  <span className="flex flex-1 flex-wrap gap-1">
                    {activeSlots.map((slot) => (
                      <span
                        key={slot}
                        className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.68rem] font-semibold tabular-nums text-primary"
                      >
                        {slot}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                <Check className="size-4" aria-hidden />
                {t("moduleGuide.demo.weekly.total", { count: total })}
              </p>
            </div>
          )}
        </div>
      </div>
    </DemoShell>
  )
}

const FREQUENCIES = [
  { key: "monthly", months: [1, 2, 3] },
  { key: "quarterly", months: [3, 6, 9] },
  { key: "biannual", months: [6, 12] },
] as const

function MaintenanceFreqDemo() {
  const { t } = useTranslation()
  const monthNames = t("moduleGuide.demo.freq.months", { returnObjects: true }) as unknown as string[]
  const [selected, setSelected] = useState<(typeof FREQUENCIES)[number]["key"]>("quarterly")
  const frequency = FREQUENCIES.find((item) => item.key === selected) ?? FREQUENCIES[1]

  const now = new Date()
  const baseMonth = now.getMonth()
  const baseYear = now.getFullYear()

  return (
    <DemoShell title={t("moduleGuide.demo.freq.title")}>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b border-border p-4 md:border-r md:border-b-0">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {t("moduleGuide.demo.freq.planFrequency")}
          </p>
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {FREQUENCIES.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={item.key === selected}
                onClick={() => setSelected(item.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[0.78rem] font-semibold transition-colors",
                  item.key === selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-muted-foreground",
                )}
              >
                {t(`moduleGuide.demo.freq.options.${item.key}`)}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("moduleGuide.demo.freq.description")}</p>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {t("moduleGuide.demo.freq.upcoming")}
          </p>
          <div className="flex flex-col gap-1.5">
            {frequency.months.map((offset) => {
              const monthIndex = (baseMonth + offset) % 12
              const year = baseYear + Math.floor((baseMonth + offset) / 12)
              return (
                <div
                  key={offset}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[0.78rem] font-semibold">{t("moduleGuide.demo.freq.orderTitle")}</span>
                    <span className="text-[0.7rem] text-muted-foreground">
                      {monthNames[monthIndex]}/{String(year).slice(2)} · {t("moduleGuide.demo.freq.orderCaption")}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DemoShell>
  )
}

function ResourcePreviewDemo({ demo }: { demo: Extract<GuideDemo, { kind: "resourcePreview" }> }) {
  const { t } = useTranslation()
  return (
    <DemoShell title={t("moduleGuide.demo.resource.title")}>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="border-b border-border p-4 md:border-r md:border-b-0">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {t("moduleGuide.demo.resource.youFill")}
          </p>
          <div className="flex flex-col gap-2">
            <MiniCard icon="tag" title={t(demo.nameKey)} caption={t("moduleGuide.demo.resource.nameLabel")} />
            <MiniCard icon="resource" title={t(demo.typeKey)} caption={t("moduleGuide.demo.resource.typeLabel")} />
          </div>
        </div>
        <div className="p-4">
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">
            {t("moduleGuide.demo.resource.customerSees")}
          </p>
          <MiniCard icon="eye" title={t(demo.nameKey)} caption={t("moduleGuide.demo.resource.availableCaption")} chevron />
        </div>
      </div>
    </DemoShell>
  )
}

function ConnectionsDemo({ demo }: { demo: Extract<GuideDemo, { kind: "connections" }> }) {
  const { t } = useTranslation()
  return (
    <DemoShell title={t("moduleGuide.demo.connections.title")}>
      <div className="flex flex-col gap-2 p-4">
        {demo.items.map((item) => (
          <MiniCard key={item.titleKey} icon={item.icon} title={t(item.titleKey)} caption={t(item.captionKey)} chevron />
        ))}
      </div>
    </DemoShell>
  )
}

const TONE_CLASSES: Record<"success" | "primary" | "muted", string> = {
  success: "bg-success/15 text-success",
  primary: "bg-primary/15 text-primary",
  muted: "bg-muted text-muted-foreground",
}

function ScreenPreviewDemo({ demo }: { demo: Extract<GuideDemo, { kind: "screenPreview" }> }) {
  const { t } = useTranslation()
  return (
    <DemoShell title={t("moduleGuide.demo.screen.title")}>
      <div className="flex flex-col gap-2 p-4">
        {demo.rows.map((row) => (
          <div key={row.titleKey} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <CalendarDays className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8rem] font-semibold">{t(row.titleKey)}</span>
              <span className="block text-[0.7rem] text-muted-foreground">{t(row.captionKey)}</span>
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold", TONE_CLASSES[row.tone])}>
              {t(row.tagKey)}
            </span>
          </div>
        ))}
      </div>
    </DemoShell>
  )
}

function MiniCard({
  icon,
  title,
  caption,
  chevron,
}: {
  icon: GuideIconName
  title: string
  caption: string
  chevron?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <GuideIcon name={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8rem] font-semibold">{title}</span>
        <span className="block text-[0.7rem] text-muted-foreground">{caption}</span>
      </span>
      {chevron ? <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </div>
  )
}
