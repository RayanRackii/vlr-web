import type { ReactElement } from "react"
import { Bell } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { NotificationsPage } from "@/features/notifications/pages/NotificationsPage"
import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
  anyOf?: readonly string[]
}

export const notificationsManifest = {
  modules: ["catalog", "rentals"],
  permissions: ["core.notifications.read"],
  navigationItems: [
    {
      labelKey: "nav.notifications",
      to: "/configuracoes/notificacoes",
      icon: Bell,
      modules: ["catalog", "rentals"],
      permissions: ["core.notifications.read", "catalog.notifications.read"],
      anyOf: true,
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/notificacoes",
        element: <NotificationsPage />,
        permission: "core.notifications.read",
        anyOf: ["catalog.notifications.read"],
      },
      {
        path: "/configuracoes/notificacoes",
        element: <NotificationsSettingsPage />,
        permission: "core.notifications.read",
        anyOf: ["catalog.notifications.read"],
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
