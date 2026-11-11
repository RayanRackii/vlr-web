import { CalendarDays } from "lucide-react"
import type { AppNavigationItem } from "@/components/layout/navigation"
import { RedirectKeepingLocation } from "@/routes/legacyScreenRedirect"
import { AgendasPage } from "./AgendasPage"

const modules = ["rentals", "catalog"] as const
const permissions = ["rentals.schedule.read", "rentals.assets.read", "rentals.reservations.read", "catalog.orders.read", "catalog.products.read"] as const

export const agendaManifest = {
  modules,
  permissions,
  navigationItems: [
    { labelKey: "nav.agendas", to: "/agendas", icon: CalendarDays, children: [
      { labelKey: "nav.agendasOverview", to: "/agendas", modules, permissions, anyOf: true },
      { labelKey: "nav.agendasResources", to: "/agendas/recursos", modules: ["rentals"], permission: "rentals.schedule.read" },
      { labelKey: "nav.agendasProduct", to: "/agendas/produto", modules: ["catalog"], permission: "catalog.orders.read" },
    ] },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      { path: "/agenda", element: <RedirectKeepingLocation to="/agendas" />, modules, anyOf: permissions },
      { path: "/agendas", element: <AgendasPage view="overview" />, modules, anyOf: permissions },
      { path: "/agendas/recursos", element: <AgendasPage view="resources" />, modules: ["rentals"], anyOf: ["rentals.schedule.read"] },
      { path: "/agendas/produto", element: <AgendasPage view="product" />, modules: ["catalog"], anyOf: ["catalog.orders.read"] },
    ],
  },
} as const
