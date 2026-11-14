import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import {
  Boxes,
  CalendarCheck,
  CalendarClock,
  Map,
} from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { reservationTabs } from "@/features/rentals/navigationTabs"
import { ResourceLegacyRedirect } from "@/routes/legacyScreenRedirect"

const ReservationsScreen = lazyPage(() => import("@/features/rentals/pages/ReservationsScreen"), "ReservationsScreen")
const RentalLayoutsPage = lazyPage(() => import("@/features/rentals/pages/RentalLayoutsPage"), "RentalLayoutsPage")
const RentalResourceEditorPage = lazyPage(() => import("@/features/rentals/pages/RentalResourceEditorPage"), "RentalResourceEditorPage")
const RentalResourcesPage = lazyPage(() => import("@/features/rentals/pages/RentalResourcesPage"), "RentalResourcesPage")
const ResourceAssistantPage = lazyPage(() => import("@/features/assistant/ResourceAssistantPage"), "ResourceAssistantPage")
const FirstStepsPage = lazyPage(() => import("@/features/rentals/pages/FirstStepsPage"), "FirstStepsPage")
const SchedulePage = lazyPage(() => import("@/features/rentals/pages/SchedulePage"), "SchedulePage")

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
      { path: "/configuracoes/recursos/cadastro", element: <RentalResourceEditorPage cadastro />, permissions: ["rentals.assets.write", "core.units.read"] },
      { path: "/configuracoes/recursos/:id/cadastro", element: <ResourceAssistantPage cadastro />, permissions: ["rentals.assets.write", "core.units.read"] },
      {
        path: "/configuracoes/recursos/novo",
        element: <ResourceLegacyRedirect />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/recursos/:id",
        element: <RentalResourceEditorPage />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/recursos/:id/assistente",
        element: <ResourceLegacyRedirect />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/configuracoes/recursos/:id/passos",
        element: <ResourceLegacyRedirect />,
        permissions: RENTAL_RESOURCES_PERMISSIONS,
      },
      {
        path: "/primeiros-passos",
        element: <FirstStepsPage />,
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
