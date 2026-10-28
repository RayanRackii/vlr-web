import { useCallback, useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { ClipboardList, ShieldCheck, UserRound, Users } from "lucide-react"
import { useTranslation } from "react-i18next"

import { filterNavigationTabs } from "@/components/layout/navigationTabs"
import { TenantRegistrationFieldsPage } from "@/features/admin/pages/TenantRegistrationFieldsPage"
import { peopleAccessTabs } from "@/features/users/navigationTabs"
import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageHeader } from "@/components/layout/PageHeader"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { listVisibleRoles } from "@/features/users/permissions/rolePolicy"
import { PeopleBottomNavigation } from "@/features/users/components/PeopleBottomNavigation"
import "@/features/users/people-access.css"
import { cn } from "@/lib/utils"

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
  const canReadCustomers = canReadUsers && can("core.customers.read")

  const [roles, setRoles] = useState<RoleResponse[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItemDto[]>([])
  const [isLoading, setIsLoading] = useState(canReadRoles)
  const [loadError, setLoadError] = useState<string | null>(null)
  const requestedTab = searchParams.get("tab")
  const tab: PeopleAccessTab = onRegistration ? "registration"
    : requestedTab === "roles" && canReadRoles ? "roles"
    : requestedTab === "customers" && canReadCustomers ? "customers" : "users"

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

  return (
    <div className="people-access mx-auto w-full space-y-5">
      <p className="people-eyebrow">{t("peopleAccess.eyebrow")}</p>
      <PageHeader
        title={t("peopleAccess.title")}
        description={t("peopleAccess.description")}
        className="mb-0 sm:mb-0"
      />

      <nav className="people-tabs" aria-label={t("peopleAccess.title")}>
        {tabItems.map((item) => {
          const isActive = tab === item.id
          const Icon = { users: Users, customers: UserRound, roles: ShieldCheck, registration: ClipboardList }[item.id]
          const content = (
            <>
              <Icon aria-hidden strokeWidth={1.75} />
              <span>{t(item.labelKey)}</span>
            </>
          )
          const className = cn("people-tab", isActive && "people-tab-active")
          return item.id === "registration" ? (
            <Link key={item.id} to="/configuracoes/cadastro" className={className} aria-current={isActive ? "page" : undefined}>
              {content}
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                void navigate(item.id === "users" ? "/pessoas-e-acesso" : `/pessoas-e-acesso?tab=${item.id}`)
              }}
              className={className}
            >
              {content}
            </button>
          )
        })}
      </nav>

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
        <div className={cn("people-content", canReadRoles && loadError === null && roles.length > 0 && tab !== "roles" && "people-content-with-summary")}>
          <div className="min-w-0">
            {tab === "users" && canReadUsers ? <PeopleUsersTab roles={roles} /> : null}
  
            {tab === "customers" && canReadCustomers ? (
              <PeopleCustomersTab />
            ) : null}
  
            {tab === "roles" && canReadRoles ? (
              <PeopleRolesTab
                roles={roles}
                catalog={catalog}
                onRolesChanged={loadRolesBundle}
              />
            ) : null}
          </div>
          {canReadRoles && loadError === null && roles.length > 0 && tab !== "roles" ? (
            <aside className="people-role-summary" aria-label={t("peopleAccess.tabs.roles")}>
              <h2>{t("peopleAccess.tabs.roles")}</h2>
              <p className="people-summary-description">{t("peopleAccess.roleSummary.description")}</p>
              <ul>
                {listVisibleRoles(roles).map((role) => (
                  <li key={role.id}>
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{role.name}</p>
                      <p className="text-xs text-muted-foreground">{t("peopleAccess.roleSummary.permissions", { count: role.permissionKeys.length })}</p>
                    </div>
                    <span className="people-role-kind">{t(role.isSystemRole ? "peopleAccess.badges.system" : "peopleAccess.badges.custom")}</span>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      )}
      <PeopleBottomNavigation />
    </div>
  )
}
