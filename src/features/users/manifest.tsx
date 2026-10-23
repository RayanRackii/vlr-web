import type { ReactElement } from "react"
import { Users } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { PeopleAccessPage } from "@/features/users/pages/PeopleAccessPage"
import { StaffProfilePage } from "@/features/users/pages/StaffProfilePage"

type FeatureRoute = {
  path: string
  element: ReactElement
  permission?: string
}

export const usersManifest = {
  modules: [],
  permissions: ["core.users.read"],
  navigationItems: [
    {
      labelKey: "nav.peopleAccess",
      to: "/pessoas-e-acesso",
      icon: Users,
      permission: "core.users.read",
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/pessoas-e-acesso",
        element: <PeopleAccessPage />,
        permission: "core.users.read",
      },
      {
        path: "/perfil",
        element: <StaffProfilePage />,
      },
    ] satisfies readonly FeatureRoute[],
  },
} as const
