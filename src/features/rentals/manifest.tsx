import type { ReactElement } from "react"
import {
  Boxes,
  CalendarCheck,
  CalendarClock,
  Map,
  ScrollText,
} from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { BookingPolicyPage } from "@/features/rentals/pages/BookingPolicyPage"
import { RentalLayoutsPage } from "@/features/rentals/pages/RentalLayoutsPage"
import { RentalResourcesPage } from "@/features/rentals/pages/RentalResourcesPage"
import { ReservationsPage } from "@/features/rentals/pages/ReservationsPage"
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
      labelKey: "nav.schedule",
      to: "/configuracoes/agenda",
      icon: CalendarClock,
      modules: ["rentals"],
      permission: "rentals.schedule.read",
    },
    {
      labelKey: "nav.layout",
      to: "/configuracoes/layout",
      icon: Map,
      modules: ["rentals"],
      permission: "rentals.layouts.read",
    },
    {
      labelKey: "nav.reservations",
      to: "/configuracoes/reservas",
      icon: CalendarCheck,
      modules: ["rentals"],
      permission: "rentals.reservations.read",
    },
    {
      labelKey: "nav.bookingPolicy",
      to: "/configuracoes/politica-reservas",
      icon: ScrollText,
      modules: ["rentals"],
      permission: "rentals.booking_policy.read",
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
        element: <ReservationsPage />,
        permissions: ["rentals.reservations.read"],
      },
      {
        path: "/configuracoes/politica-reservas",
        element: <BookingPolicyPage />,
        permissions: ["rentals.booking_policy.read"],
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
