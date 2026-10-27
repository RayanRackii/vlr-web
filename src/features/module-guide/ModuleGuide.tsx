import { useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CheckCircle2, RotateCcw, Trophy, Volume2, VolumeX, type LucideIcon } from "lucide-react"

import { playGuideRewardSound } from "./guideSound"
import type { GuideStep, ModuleGuideConfig } from "./types"
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
}

function stepTarget(step: GuideStep, shortcuts: readonly GuideTarget[], related: readonly GuideTarget[]) {
  if (step.kind === "visitShortcut") return shortcuts[0]
  if (step.kind === "exploreRelated") return related[0]
  return undefined
}

export function ModuleGuide({ config, titleKey, summaryKey, icon: Icon, shortcuts, related, userId }: ModuleGuideProps) {
  const { t } = useTranslation()
  const reducedMotion = usePrefersReducedMotion()
  const progress = useGuideProgress(userId, config.key, config.steps)
  const [announcement, setAnnouncement] = useState("")
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null)
  const [justEarnedBadgeId, setJustEarnedBadgeId] = useState<string | null>(null)

  const currentStep = config.steps.find((step) => !progress.isStepDone(step.id))
  const celebrationClass = reducedMotion ? "" : "animate-in"

  function markStepDone(step: GuideStep) {
    if (progress.isStepDone(step.id)) return
    const badgeNewlyEarned = step.badgeId
      ? config.badges.find((badge) => badge.id === step.badgeId && progress.completedCount + 1 >= badge.threshold)
      : undefined
    progress.completeStep(step.id)
    if (progress.soundOn) playGuideRewardSound()
    setJustCompletedId(step.id)
    setTimeout(() => setJustCompletedId(null), reducedMotion ? 0 : 600)
    setAnnouncement(t("moduleGuide.reward.stepAnnouncement", { step: t(step.titleKey), points: step.points }))
    if (badgeNewlyEarned) {
      setJustEarnedBadgeId(badgeNewlyEarned.id)
      setTimeout(() => setJustEarnedBadgeId(null), reducedMotion ? 0 : 600)
      setAnnouncement(t("moduleGuide.reward.badgeAnnouncement", { badge: t(badgeNewlyEarned.labelKey) }))
    }
  }

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon {...iconProps("md")} />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(summaryKey)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-sm",
              !reducedMotion && justCompletedId && "animate-pulse",
            )}
          >
            <Trophy className="size-4 text-[var(--gold,theme(colors.amber.500))]" aria-hidden />
            <span>{t("moduleGuide.pointsLabel", { points: progress.points })}</span>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            {progress.soundOn ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
            <span className="sr-only sm:not-sr-only">{t("moduleGuide.soundToggle")}</span>
            <Switch
              size="sm"
              checked={progress.soundOn}
              onCheckedChange={() => progress.toggleSound()}
              aria-label={t("moduleGuide.soundToggle")}
            />
          </label>
        </div>
      </header>

      <div aria-live="polite" className="sr-only">{announcement}</div>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t("moduleGuide.roadmapTitle")}</h2>
            <div className="flex min-w-[160px] flex-1 items-center gap-2 sm:flex-none">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:w-28">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${(progress.completedCount / progress.totalSteps) * 100}%` }}
                />
              </div>
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                {t("moduleGuide.progressLabel", { completed: progress.completedCount, total: progress.totalSteps })}
              </span>
            </div>
          </div>

          <ol aria-label={t("moduleGuide.roadmapTitle")} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            {config.steps.map((step, index) => {
              const done = progress.isStepDone(step.id)
              const isCurrent = currentStep?.id === step.id
              const state = done ? "done" : isCurrent ? "active" : "todo"
              return (
                <li
                  key={step.id}
                  aria-current={isCurrent ? "step" : undefined}
                  data-state={state}
                  className={cn(
                    "flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-border p-3 transition-colors duration-150 ease-out sm:min-w-[160px] sm:flex-col sm:items-start sm:gap-2",
                    "data-[state=active]:border-primary data-[state=active]:bg-primary/5",
                    "data-[state=done]:border-success data-[state=done]:bg-success/5",
                    justCompletedId === step.id && !reducedMotion && "scale-[1.02]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-border text-xs font-semibold text-muted-foreground transition-transform duration-150 ease-out",
                      "data-[state=active]:scale-110",
                      state === "active" && "scale-110 border-primary text-primary",
                      state === "done" && "border-success bg-success text-success-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-4" aria-hidden /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{t(step.titleKey)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(step.descriptionKey)}</p>
                  </div>
                </li>
              )
            })}
          </ol>

          {currentStep ? (
            <StepAction
              step={currentStep}
              target={stepTarget(currentStep, shortcuts, related)}
              onMarkDone={markStepDone}
            />
          ) : (
            <div className={cn("rounded-lg border border-success/30 bg-success/5 p-4 text-sm", celebrationClass)}>
              <p className="font-semibold">{t("moduleGuide.nextAction.allDone")}</p>
              <p className="mt-1 text-muted-foreground">{t("moduleGuide.nextAction.allDoneDescription")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="module-guide-badges" className="space-y-3">
        <h2 id="module-guide-badges" className="text-base font-semibold">{t("moduleGuide.badgesTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {config.badges.map((badge) => {
            const earned = progress.completedCount >= badge.threshold
            return (
              <span
                key={badge.id}
                data-earned={earned}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 ease-out",
                  earned && "border-amber-400/60 bg-amber-400/15 text-amber-700 dark:text-amber-300",
                  justEarnedBadgeId === badge.id && !reducedMotion && "scale-110",
                )}
              >
                <Trophy className="size-3.5" aria-hidden />
                {t(badge.labelKey)}
              </span>
            )
          })}
        </div>
      </section>

      <div>
        <Button variant="ghost" size="sm" onClick={progress.reset}>
          <RotateCcw className="size-3.5" aria-hidden />
          {t("moduleGuide.reset")}
        </Button>
      </div>
    </div>
  )
}

function StepAction({
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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("moduleGuide.nextAction.eyebrow")}</p>
        <p className="mt-1 text-sm font-medium">{t(step.titleKey)}</p>
      </div>
      {step.kind !== "learn" && target ? (
        <Button data-testid="guide-next-action" onClick={() => onMarkDone(step)} render={<Link to={target.to} />}>
          {t(step.kind === "visitShortcut" ? "moduleGuide.goToScreen" : "moduleGuide.exploreModule", {
            label: t(target.labelKey),
          })}
        </Button>
      ) : (
        <Button data-testid="guide-next-action" onClick={() => onMarkDone(step)}>{t("moduleGuide.markDone")}</Button>
      )}
    </div>
  )
}
