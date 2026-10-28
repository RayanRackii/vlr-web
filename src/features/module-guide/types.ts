import type { ModuleIntroKey } from "@/components/layout/navigationIntros"

/** A step's completion shape: learning steps are self-reported, the other two drive the user to a real screen. */
export type GuideStepKind = "learn" | "visitShortcut" | "exploreRelated"

/**
 * Stable names for the fixed set of lucide icons the guide can render. The
 * ModuleGuide component owns the name → icon mapping so config/locale data
 * never imports icon components and the component stays module-agnostic.
 */
export type GuideIconName =
  | "resource"
  | "hours"
  | "connect"
  | "screen"
  | "compass"
  | "equipment"
  | "plan"
  | "order"
  | "calendar"
  | "eye"
  | "tag"
  | "map"
  | "grid"
  | "users"
  | "cart"
  | "wrench"
  | "book"
  | "sliders"
  | "check"

/** One node in a left-to-right (stacked on mobile) concept flow diagram. */
export type GuideDiagramNode = {
  icon: GuideIconName
  titleKey: string
  captionKey: string
}

/** Pill tone for a screen-preview row's status tag. */
export type GuidePreviewTone = "success" | "primary" | "muted"

/**
 * Generic, module-agnostic demo kinds. The component knows how to render each
 * kind; the config only chooses a kind and supplies i18n keys for its labels.
 */
export type GuideDemo =
  | { kind: "weeklyHours" }
  | { kind: "maintenanceFreq" }
  | { kind: "resourcePreview"; nameKey: string; typeKey: string }
  | {
      kind: "connections"
      items: readonly { icon: GuideIconName; titleKey: string; captionKey: string }[]
    }
  | {
      kind: "screenPreview"
      rows: readonly { titleKey: string; captionKey: string; tagKey: string; tone: GuidePreviewTone }[]
    }

/** The mini-lesson shown for the current step: a diagram, an explanation, why it matters, and an optional demo. */
export type GuideLesson = {
  headlineKey: string
  diagram: readonly GuideDiagramNode[]
  explanationKey: string
  whyItMattersKeys: readonly string[]
  demo?: GuideDemo
}

export type GuideStep = {
  id: string
  icon: GuideIconName
  kind: GuideStepKind
  titleKey: string
  /** Short caption shown under the roadmap node. Optional — generic modules omit it. */
  shortKey?: string
  /** Rough time estimate in minutes, shown as a chip next to the next action. */
  estMinutes: number
  lesson: GuideLesson
}

export type ModuleGuideConfig = {
  key: ModuleIntroKey
  steps: readonly GuideStep[]
}
