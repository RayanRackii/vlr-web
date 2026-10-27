import type { NavigationTab } from "@/components/layout/navigationTabs"

export const peopleAccessTabs = [
  { labelKey: "nav.peopleAccess", to: "/pessoas-e-acesso", permission: "core.users.read", modules: [] },
  { labelKey: "nav.registrationFields", to: "/configuracoes/cadastro", permission: "core.registration_fields.read", modules: ["rentals", "catalog"] },
] as const satisfies readonly NavigationTab[]
