import { CalendarDays } from "lucide-react"
import type { AppNavigationItem } from "@/components/layout/navigation"
import { AgendaPage } from "./AgendaPage"

const modules = ["rentals", "catalog"] as const
const permissions = ["rentals.schedule.read", "rentals.assets.read", "rentals.reservations.read", "catalog.orders.read", "catalog.products.read"] as const

export const agendaManifest = {
  modules,
  permissions,
  navigationItems: [{ labelKey: "nav.agenda", to: "/agenda", icon: CalendarDays, modules, permissions, anyOf: true }] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [{ path: "/agenda", element: <AgendaPage />, modules, anyOf: permissions }],
  },
} as const
