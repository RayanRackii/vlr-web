import type { ModuleIntroKey } from "@/components/layout/navigationIntros"

/** A step's completion shape: learning steps are self-reported, the other two drive the user to a real screen. */
export type GuideStepKind = "learn" | "visitShortcut" | "exploreRelated"

export type GuideStep = {
  id: string
  titleKey: string
  descriptionKey: string
  kind: GuideStepKind
  points: number
  badgeId?: string
}

export type GuideBadge = {
  id: string
  labelKey: string
  /** Earned once this many steps are complete. */
  threshold: number
}

export type ModuleGuideConfig = {
  key: ModuleIntroKey
  steps: readonly GuideStep[]
  badges: readonly GuideBadge[]
}
