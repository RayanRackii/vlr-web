import type { GuideBadge, GuideStep, ModuleGuideConfig } from "./types"
import { moduleIntroContent, type ModuleIntroKey } from "@/components/layout/navigationIntros"

const BADGES: readonly GuideBadge[] = [
  { id: "firstStep", labelKey: "moduleGuide.badges.firstStep", threshold: 1 },
  { id: "halfway", labelKey: "moduleGuide.badges.halfway", threshold: 3 },
  { id: "complete", labelKey: "moduleGuide.badges.complete", threshold: 5 },
]

/**
 * Every module gets the same 5-step shape (learn the 3 core concepts, visit a
 * real screen, explore a related module) with module-specific copy pulled
 * from the existing navigation intro content. Modules without related modules
 * (e.g. platform) get a "wrap up" step instead of "explore related".
 */
function buildSteps(key: ModuleIntroKey): readonly GuideStep[] {
  const content = moduleIntroContent[key]
  const hasRelated = content.relatedModuleKeys.length > 0
  const learnSteps: GuideStep[] = content.howItWorksKeys.map((descriptionKey, index) => ({
    id: `${key}-learn-${index + 1}`,
    titleKey: `moduleGuide.steps.${key}.learn${index + 1}.title`,
    descriptionKey,
    kind: "learn",
    points: 10,
    // threshold 1 fires on the very first completed step, so "firstStep" belongs here, not on a later step.
    ...(index === 0 ? { badgeId: "firstStep" } : {}),
    ...(index === 2 ? { badgeId: "halfway" } : {}),
  }))
  return [
    ...learnSteps,
    {
      id: `${key}-visit`,
      titleKey: "moduleGuide.steps.visit.title",
      descriptionKey: "moduleGuide.steps.visit.description",
      kind: "visitShortcut",
      points: 15,
    },
    hasRelated
      ? {
          id: `${key}-related`,
          titleKey: "moduleGuide.steps.related.title",
          descriptionKey: "moduleGuide.steps.related.description",
          kind: "exploreRelated",
          points: 15,
          badgeId: "complete",
        }
      : {
          id: `${key}-wrapUp`,
          titleKey: "moduleGuide.steps.wrapUp.title",
          descriptionKey: "moduleGuide.steps.wrapUp.description",
          kind: "learn",
          points: 15,
          badgeId: "complete",
        },
  ]
}

function buildConfig(key: ModuleIntroKey): ModuleGuideConfig {
  return { key, steps: buildSteps(key), badges: BADGES }
}

export const moduleGuideConfigs: Record<ModuleIntroKey, ModuleGuideConfig> = Object.fromEntries(
  (Object.keys(moduleIntroContent) as ModuleIntroKey[]).map((key) => [key, buildConfig(key)]),
) as Record<ModuleIntroKey, ModuleGuideConfig>
