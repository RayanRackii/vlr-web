import type { ReactElement } from "react"
import {
  Boxes,
  CalendarCheck,
  CalendarClock,
  Map,
} from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { reservationTabs } from "@/features/rentals/navigationTabs"
import { ReservationsScreen } from "@/features/rentals/pages/ReservationsScreen"
import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"
import { RentalResourcesPage } from "@/features/rentals/pages/RentalResourcesPage"
import { SchedulePage } from "@/features/rentals/pages/SchedulePage"

type FeatureRoute = {
  path: string
  element: ReactElement
  permissions: readonly string[]
}

/**
 * Recursos lists rentable assets and loads `GET /api/units` (`core.units.read`).
 * Court listing for lessons stays on `rentals.assets.read` alone.
 */
export const RENTAL_RESOURCES_PERMISSIONS = [
  "rentals.assets.read",
  "core.units.read",
] as const

export const rentalsManifest = {
  modules: ["rentals"],
  permissions: [
    "rentals.assets.read",
    "core.units.read",
    "rentals.schedule.read",
    "rentals.layouts.read",
    "rentals.reservations.read",
    "rentals.booking_policy.read",
  ],
  navigationItems: [
    {
      labelKey: "nav.rentalsResources",
      to: "/configuracoes/recursos",
      icon: Boxes,
      modules: ["rentals"],
      permissions: RENTAL_RESOURCES_PERMISSIONS,
    },
    {
      labelKey: "nav.layout",
      to: "/configuracoes/layout",
      icon: Map,
      modules: ["rentals"],
      permission: "rentals.layouts.read",
    },
    {
      labelKey: "nav.schedule",
      to: "/configuracoes/agenda",
      icon: CalendarClock,
      modules: ["rentals"],
      permission: "rentals.schedule.read",
    },
    {
      labelKey: "nav.reservations",
      to: "/configuracoes/reservas",
      icon: CalendarCheck,
      modules: ["rentals"],
      tabs: reservationTabs,
    },

  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/configuracoes/recursos",
        element: <RentalResourcesPage />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/agenda",
        element: <SchedulePage />,
        permissions: ["rentals.schedule.read"],
      },
      {
        path: "/configuracoes/layout",
        element: <RentalLayoutsPage />,
        permissions: ["rentals.layouts.read"],
      },
      {
        path: "/configuracoes/reservas",
        element: <ReservationsScreen />,
        permissions: ["rentals.reservations.read"],
      },
      {
        path: "/configuracoes/politica-reservas",
        element: <ReservationsScreen />,
        permissions: ["rentals.booking_policy.read"],
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
