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
import { RentalResourceEditorPage } from "@/features/rentals/pages/RentalResourceEditorPage"
import { RentalResourcesPage } from "@/features/rentals/pages/RentalResourcesPage"
import { ResourceWizardPage } from "@/features/rentals/pages/ResourceWizardPage"
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

/**
 * Agenda lists rentable assets (`GET /api/rental-assets`, `rentals.assets.read`)
 * and the day (`rentals.schedule.read`). Either key alone cannot open the page.
 */
export const SCHEDULE_PAGE_PERMISSIONS = [
  "rentals.schedule.read",
  "rentals.assets.read",
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
      permissions: SCHEDULE_PAGE_PERMISSIONS,
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
        path: "/configuracoes/recursos/novo",
        element: <RentalResourceEditorPage />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/recursos/:id",
        element: <RentalResourceEditorPage />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/recursos/:id/assistente",
        element: <ResourceWizardPage />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/agenda",
        element: <SchedulePage />,
        permissions: SCHEDULE_PAGE_PERMISSIONS,
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
