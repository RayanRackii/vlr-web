import type { NavigationTab } from "@/components/layout/navigationTabs"

export const newPlanTabs = [
  { labelKey: "nav.pmocCustom", to: "/pmoc/novo", permission: "pmoc.plans.write", modules: ["pmoc"] },
  { labelKey: "nav.pmocLibrary", to: "/pmoc/biblioteca", permission: "pmoc.templates.read", modules: ["pmoc"] },
] as const satisfies readonly NavigationTab[]
