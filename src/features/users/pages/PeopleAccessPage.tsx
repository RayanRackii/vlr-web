import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { filterNavigationTabs } from "@/components/layout/navigationTabs"
import { TenantRegistrationFieldsPage } from "@/features/admin/pages/TenantRegistrationFieldsPage"
import { peopleAccessTabs } from "@/features/users/navigationTabs"
import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { Page } from "@/components/layout/Page"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PeopleCustomersTab } from "@/features/users/components/PeopleCustomersTab"
import { PeopleRolesTab } from "@/features/users/components/PeopleRolesTab"
import { PeopleUsersTab } from "@/features/users/components/PeopleUsersTab"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type {
  PermissionCatalogItemDto,
  RoleResponse,
} from "@/features/users/schemas/roleSchemas"
import {
  listPermissions,
  listRoles,
} from "@/features/users/services/rolesService"

type PeopleAccessTab = "users" | "customers" | "roles" | "registration"

export function PeopleAccessPage() {
  const { t } = useTranslation()
  const { can, activeModules, permissions } = usePermissions()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const onRegistration = pathname.replace(/\/+$/, "") === "/configuracoes/cadastro"
  const canReadUsers = can("core.users.read")
  const canReadRegistration = filterNavigationTabs(peopleAccessTabs, activeModules, permissions)
    .some((entry) => entry.to === "/configuracoes/cadastro")
  const canReadRoles = canReadUsers && can("core.roles.read")
  const canReadCustomers = can("core.customers.read")

  const [roles, setRoles] = useState<RoleResponse[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItemDto[]>([])
  const [isLoading, setIsLoading] = useState(canReadRoles)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const requestedTab = searchParams.get("tab")
  const tab: PeopleAccessTab = onRegistration ? "registration"
    : requestedTab === "roles" && canReadRoles ? "roles"
    : requestedTab === "customers" && canReadCustomers ? "customers"
    : canReadUsers ? "users"
    : canReadCustomers ? "customers"
    : "users"

  const loadRolesBundle = useCallback(async () => {
    if (!canReadRoles || onRegistration) {
      setRoles([])
      setCatalog([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const [nextRoles, nextCatalog] = await Promise.all([
        listRoles(),
        listPermissions(),
      ])
      setRoles(nextRoles)
      setCatalog(nextCatalog)
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.loadRoles"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [canReadRoles, onRegistration, t])

  useEffect(() => {
    void loadRolesBundle()
  }, [loadRolesBundle])

  const tabItems: { id: PeopleAccessTab; labelKey: string }[] = [
    ...(canReadUsers ? [{ id: "users" as const, labelKey: "peopleAccess.tabs.users" }] : []),
    ...(canReadCustomers
      ? [{ id: "customers" as const, labelKey: "peopleAccess.tabs.customers" }]
      : []),
    ...(canReadRoles
      ? [{ id: "roles" as const, labelKey: "peopleAccess.tabs.roles" }]
      : []),
    ...(canReadRegistration
      ? [{ id: "registration" as const, labelKey: "nav.registrationFields" }]
      : []),
  ]

  if (onRegistration && !canReadRegistration) return <AccessDeniedPage />

  function selectTab(next: PeopleAccessTab) {
    if (next === "registration") void navigate("/configuracoes/cadastro")
    else void navigate(next === "users" ? "/pessoas-e-acesso" : `/pessoas-e-acesso?tab=${next}`)
  }

  const canInvite = tab === "users" && canReadUsers && can("core.users.invite")

  return (
    <Page
      width="wide"
      header={{
        title: t(onRegistration ? "admin.registrationFields.tenantPageTitle" : "peopleAccess.title"),
        description: t(onRegistration ? "admin.registrationFields.tenantPageDescription" : "peopleAccess.description"),
        actions: canInvite ? (
          <Button
            type="button"
            onClick={() => {
              setInviteOpen(true)
            }}
          >
            <UserPlus aria-hidden strokeWidth={1.75} />
            {t("peopleAccess.users.invite")}
          </Button>
        ) : undefined,
      }}
    >
      <Tabs value={tab} onValueChange={(value) => { selectTab(value as PeopleAccessTab) }}>
        <TabsList variant="line" aria-label={t("peopleAccess.title")}>
          {tabItems.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {t(item.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab !== "registration" && loadError !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {tab === "registration" ? (
        canReadRegistration ? <TenantRegistrationFieldsPage embedded /> : null
      ) : canReadRoles && isLoading ? (
        <PageContentSkeleton rows={4} />
      ) : (
        <div className="min-w-0">
          {tab === "users" && canReadUsers ? (
            <PeopleUsersTab roles={roles} inviteOpen={inviteOpen} onInviteOpenChange={setInviteOpen} />
          ) : null}

          {tab === "customers" && canReadCustomers ? <PeopleCustomersTab /> : null}

          {tab === "roles" && canReadRoles ? (
            <PeopleRolesTab
              roles={roles}
              catalog={catalog}
              onRolesChanged={loadRolesBundle}
            />
          ) : null}
        </div>
      )}
    </Page>
  )
}
