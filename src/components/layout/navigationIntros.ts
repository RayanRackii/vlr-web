import type { AppNavigationItem, AppNavigationSection } from "./navigation"

export type ModuleIntroKey = "overview" | "bookings" | "maintenance" | "sales" | "peoplePortal" | "pmoc" | "platform"

type ModuleIntroContent = {
  summaryKey: string
  howItWorksKeys: readonly string[]
  relatedModuleKeys: readonly ModuleIntroKey[]
}

function intro(key: ModuleIntroKey, relatedModuleKeys: readonly ModuleIntroKey[]): ModuleIntroContent {
  const prefix = `moduleIntro.modules.${key}`
  return {
    summaryKey: `${prefix}.summary`,
    howItWorksKeys: [1, 2, 3].map((point) => `${prefix}.how${point}`),
    relatedModuleKeys,
  }
}

/** Copy lives beside the nav registry; names and destinations come from the nav itself. */
export const moduleIntroContent: Record<ModuleIntroKey, ModuleIntroContent> = {
  overview: intro("overview", ["bookings", "maintenance", "sales", "peoplePortal"]),
  bookings: intro("bookings", ["maintenance", "peoplePortal", "sales"]),
  maintenance: intro("maintenance", ["pmoc", "bookings"]),
  sales: intro("sales", ["peoplePortal", "bookings"]),
  peoplePortal: intro("peoplePortal", ["bookings", "sales"]),
  pmoc: intro("pmoc", ["maintenance"]),
  platform: intro("platform", []),
}

export type ModuleIntro = ModuleIntroContent & {
  key: ModuleIntroKey
  titleKey: AppNavigationSection["titleKey"] | AppNavigationItem["labelKey"]
  items: readonly AppNavigationItem[]
}

export function moduleIntroPath(key: ModuleIntroKey): string {
  return `/modulos/${key}`
}

/** Only consume already-filtered navigation so intros inherit every existing gate. */
export function availableModuleIntros(sections: readonly AppNavigationSection[]): ModuleIntro[] {
  return sections.flatMap((section) => {
    const intros: ModuleIntro[] = []
    if (section.introKey && section.items.length) {
      intros.push({ key: section.introKey, titleKey: section.titleKey, items: section.items, ...moduleIntroContent[section.introKey] })
    }
    for (const item of section.items) {
      if (item.introKey) {
        intros.push({ key: item.introKey, titleKey: item.labelKey, items: [item], ...moduleIntroContent[item.introKey] })
      }
    }
    return intros
  })
}

export function matchModuleIntro(sections: readonly AppNavigationSection[], pathname: string): ModuleIntro | undefined {
  const path = pathname.replace(/\/+$/, "")
  return availableModuleIntros(sections).find((entry) => moduleIntroPath(entry.key) === path)
}

export function moduleIntroShortcuts(items: readonly AppNavigationItem[]): { labelKey: string; to: string }[] {
  const shortcuts = new Map<string, { labelKey: string; to: string }>()
  for (const item of items) {
    for (const entry of item.children?.length ? item.children : [item]) {
      for (const shortcut of entry.tabs ?? [entry]) shortcuts.set(shortcut.to, shortcut)
    }
  }
  return [...shortcuts.values()]
}
