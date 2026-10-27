import type { NavigationTab } from "@/components/layout/navigationTabs"

export const equipmentTabs = [
  { labelKey: "nav.assetsInventory", to: "/ativos", permission: "inventory.assets.read", modules: ["inventory"] },
  { labelKey: "nav.assetsCategories", to: "/ativos/categorias", permission: "inventory.categories.read", modules: ["inventory"] },
] as const satisfies readonly NavigationTab[]
