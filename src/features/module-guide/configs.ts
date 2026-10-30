import type { GuideDemo, GuideDiagramNode, GuideIconName, GuideLesson, GuideStep, ModuleGuideConfig } from "./types"
import { moduleIntroContent, type ModuleIntroKey } from "@/components/layout/navigationIntros"

/** A diagram node whose copy lives under `<base>.d<n>.{t,c}`. */
function dnode(base: string, index: number, icon: GuideIconName): GuideDiagramNode {
  return { icon, titleKey: `${base}.d${index}.t`, captionKey: `${base}.d${index}.c` }
}

function diagram(base: string, icons: readonly GuideIconName[]): GuideDiagramNode[] {
  return icons.map((icon, i) => dnode(base, i + 1, icon))
}

/** Connection rows whose copy lives under `<base>.c<n>.{t,c}`. */
function connections(base: string, items: readonly GuideIconName[]): GuideDemo {
  return {
    kind: "connections",
    items: items.map((icon, i) => ({ icon, titleKey: `${base}.c${i + 1}.t`, captionKey: `${base}.c${i + 1}.c` })),
  }
}

/** Screen-preview rows whose copy lives under `<base>.r<n>.{t,s,tag}`. */
function screenPreview(base: string, rows: readonly { tone: "success" | "primary" | "muted" }[]): GuideDemo {
  return {
    kind: "screenPreview",
    rows: rows.map((row, i) => ({
      titleKey: `${base}.r${i + 1}.t`,
      captionKey: `${base}.r${i + 1}.s`,
      tagKey: `${base}.r${i + 1}.tag`,
      tone: row.tone,
    })),
  }
}

type ShowcaseSpec = {
  slug: string
  icon: GuideIconName
  kind: GuideStep["kind"]
  est: number
  diagram: readonly GuideIconName[]
  demo?: (base: string) => GuideDemo
}

function buildShowcaseSteps(key: ModuleIntroKey, specs: readonly ShowcaseSpec[]): GuideStep[] {
  return specs.map((spec) => {
    const base = `moduleGuide.lessons.${key}.${spec.slug}`
    const titleKey =
      spec.slug === "visit"
        ? "moduleGuide.steps.visit.title"
        : spec.slug === "related"
          ? "moduleGuide.steps.related.title"
          : `moduleGuide.steps.${key}.${spec.slug}.title`
    const lesson: GuideLesson = {
      headlineKey: `${base}.headline`,
      diagram: diagram(base, spec.diagram),
      explanationKey: `${base}.explanation`,
      whyItMattersKeys: [1, 2, 3].map((n) => `${base}.why${n}`),
      ...(spec.demo ? { demo: spec.demo(base) } : {}),
    }
    return {
      id: `${key}-${spec.slug}`,
      icon: spec.icon,
      kind: spec.kind,
      titleKey,
      shortKey: `${base}.short`,
      estMinutes: spec.est,
      lesson,
    }
  })
}

/* ----------------------------- Showcase modules ----------------------------- */

const BOOKINGS_STEPS = buildShowcaseSteps("bookings", [
  {
    slug: "learn1",
    icon: "resource",
    kind: "learn",
    est: 2,
    diagram: ["resource", "tag", "map", "eye"],
    demo: (base) => ({ kind: "resourcePreview", nameKey: `${base}.demoName`, typeKey: `${base}.demoType` }),
  },
  {
    slug: "learn2",
    icon: "hours",
    kind: "learn",
    est: 2,
    diagram: ["resource", "hours", "grid", "calendar"],
    demo: () => ({ kind: "weeklyHours" }),
  },
  {
    slug: "learn3",
    icon: "connect",
    kind: "learn",
    est: 3,
    diagram: ["calendar", "cart", "users", "wrench"],
    demo: (base) => connections(base, ["cart", "users", "wrench"]),
  },
  {
    slug: "visit",
    icon: "screen",
    kind: "visitShortcut",
    est: 1,
    diagram: ["book", "screen", "calendar", "order"],
    demo: (base) => screenPreview(base, [{ tone: "success" }, { tone: "primary" }, { tone: "success" }]),
  },
  {
    slug: "related",
    icon: "compass",
    kind: "exploreRelated",
    est: 2,
    diagram: ["resource", "users", "wrench", "cart"],
    demo: (base) => connections(base, ["users", "wrench", "cart"]),
  },
])

const MAINTENANCE_STEPS = buildShowcaseSteps("maintenance", [
  {
    slug: "learn1",
    icon: "equipment",
    kind: "learn",
    est: 2,
    diagram: ["equipment", "tag", "map", "book"],
    demo: (base) => ({ kind: "resourcePreview", nameKey: `${base}.demoName`, typeKey: `${base}.demoType` }),
  },
  {
    slug: "learn2",
    icon: "plan",
    kind: "learn",
    est: 3,
    diagram: ["equipment", "plan", "hours", "order"],
    demo: () => ({ kind: "maintenanceFreq" }),
  },
  {
    slug: "learn3",
    icon: "connect",
    kind: "learn",
    est: 3,
    diagram: ["order", "resource", "cart", "users"],
    demo: (base) => connections(base, ["resource", "cart", "users"]),
  },
  {
    slug: "visit",
    icon: "screen",
    kind: "visitShortcut",
    est: 1,
    diagram: ["book", "screen", "order", "calendar"],
    demo: (base) => screenPreview(base, [{ tone: "primary" }, { tone: "muted" }, { tone: "success" }]),
  },
  {
    slug: "related",
    icon: "compass",
    kind: "exploreRelated",
    est: 2,
    diagram: ["wrench", "resource", "cart", "users"],
    demo: (base) => connections(base, ["resource", "cart", "users"]),
  },
])

/* ------------------------------ Generic modules ----------------------------- */

const GENERIC_LEARN_ICONS: readonly GuideIconName[] = ["book", "sliders", "connect"]

function genericLearnLesson(key: ModuleIntroKey, n: number): GuideLesson {
  const base = "moduleGuide.lessons.generic.learn"
  return {
    headlineKey: `${base}.headline`,
    diagram: diagram(base, ["book", "sliders", "connect", "check"]),
    explanationKey: `moduleIntro.modules.${key}.how${n}`,
    whyItMattersKeys: [1, 2, 3].map((i) => `${base}.why${i}`),
  }
}

function genericLesson(slug: "visit" | "related"): GuideLesson {
  const base = `moduleGuide.lessons.generic.${slug}`
  return {
    headlineKey: `${base}.headline`,
    diagram: diagram(base, slug === "visit" ? ["book", "screen", "grid", "check"] : ["grid", "users", "cart", "compass"]),
    explanationKey: `${base}.explanation`,
    whyItMattersKeys: [1, 2, 3].map((i) => `${base}.why${i}`),
  }
}

function buildGenericSteps(key: ModuleIntroKey): GuideStep[] {
  const content = moduleIntroContent[key]
  const hasRelated = content.relatedModuleKeys.length > 0
  const learnSteps: GuideStep[] = [1, 2, 3].map((n, index) => ({
    id: `${key}-learn-${n}`,
    icon: GENERIC_LEARN_ICONS[index],
    kind: "learn",
    titleKey: `moduleGuide.steps.${key}.learn${n}.title`,
    estMinutes: 2,
    lesson: genericLearnLesson(key, n),
  }))
  return [
    ...learnSteps,
    {
      id: `${key}-visit`,
      icon: "screen",
      kind: "visitShortcut",
      titleKey: "moduleGuide.steps.visit.title",
      estMinutes: 1,
      lesson: genericLesson("visit"),
    },
    hasRelated
      ? {
          id: `${key}-related`,
          icon: "compass",
          kind: "exploreRelated",
          titleKey: "moduleGuide.steps.related.title",
          estMinutes: 2,
          lesson: genericLesson("related"),
        }
      : {
          id: `${key}-wrapUp`,
          icon: "compass",
          kind: "learn",
          titleKey: "moduleGuide.steps.wrapUp.title",
          estMinutes: 1,
          lesson: genericLesson("related"),
        },
  ]
}

const SHOWCASE_STEPS: Partial<Record<ModuleIntroKey, readonly GuideStep[]>> = {
  bookings: BOOKINGS_STEPS,
  maintenance: MAINTENANCE_STEPS,
}

function buildConfig(key: ModuleIntroKey): ModuleGuideConfig {
  return { key, steps: SHOWCASE_STEPS[key] ?? buildGenericSteps(key) }
}

export const moduleGuideConfigs: Record<ModuleIntroKey, ModuleGuideConfig> = Object.fromEntries(
  (Object.keys(moduleIntroContent) as ModuleIntroKey[]).map((key) => [key, buildConfig(key)]),
) as Record<ModuleIntroKey, ModuleGuideConfig>
