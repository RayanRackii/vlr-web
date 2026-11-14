import type { ReactElement } from "react"
import { lazyPage } from "@/routes/lazyPage"
import { Users } from "lucide-react"

import type { AppNavigationItem } from "@/components/layout/navigation"
import { peopleAccessTabs } from "@/features/users/navigationTabs"

const PeopleAccessPage = lazyPage(() => import("@/features/users/pages/PeopleAccessPage"), "PeopleAccessPage")
const PortalCustomerPage = lazyPage(() => import("@/features/users/pages/PortalCustomerPage"), "PortalCustomerPage")
const RoleCreatePage = lazyPage(() => import("@/features/users/pages/RoleCreatePage"), "RoleCreatePage")
const RoleEditorPage = lazyPage(() => import("@/features/users/pages/RoleEditorPage"), "RoleEditorPage")
const StaffProfilePage = lazyPage(() => import("@/features/users/pages/StaffProfilePage"), "StaffProfilePage")

type FeatureRoute = {
  path: string
  element: ReactElement
  permission?: string
  anyOf?: readonly string[]
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
        anyOf: ["core.customers.read"],
      },
      {
        path: "/pessoas-e-acesso/funcoes/nova",
        element: <RoleCreatePage />,
        permission: "core.roles.manage",
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
