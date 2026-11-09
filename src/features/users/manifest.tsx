import type { ReactElement } from "react"
import { Users } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { peopleAccessTabs } from "@/features/users/navigationTabs"
import { PeopleAccessPage } from "@/features/users/pages/PeopleAccessPage"
import { PortalCustomerPage } from "@/features/users/pages/PortalCustomerPage"
import { RoleEditorPage } from "@/features/users/pages/RoleEditorPage"
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
      tabs: peopleAccessTabs,
    },
  ] satisfies readonly AppNavigationItem[],
  routes: {
    staff: [
      {
        path: "/pessoas-e-acesso/clientes/:id",
        element: <PortalCustomerPage />,
        permission: "core.customers.read",
      },
      {
        path: "/pessoas-e-acesso",
        element: <PeopleAccessPage />,
        permission: "core.users.read",
      },
      {
        path: "/pessoas-e-acesso/funcoes/:id",
        element: <RoleEditorPage />,
        permission: "core.roles.read",
      },
      {
        path: "/perfil",
        element: <StaffProfilePage />,
      },
    ] as readonly FeatureRoute[],
  },
} as const
