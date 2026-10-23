import type { ReactElement } from "react"
import { Bell } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { NotificationsSettingsPage } from "@/features/notifications/pages/NotificationsSettingsPage"

type FeatureRoute = {
  path: string
  element: ReactElement
  permission: string
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
      permission: "core.notifications.read",
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/configuracoes/notificacoes",
        element: <NotificationsSettingsPage />,
        permission: "core.notifications.read",
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
