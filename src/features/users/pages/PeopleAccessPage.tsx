import { useCallback, useEffect, useState } from "react"
import { Users } from "lucide-react"
import { useTranslation } from "react-i18next"

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
import { cn } from "@/lib/utils"

type PeopleAccessTab = "users" | "customers" | "roles"

export function PeopleAccessPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canReadRoles = can("core.roles.read")
  const canReadCustomers = can("core.customers.read")

  const [roles, setRoles] = useState<RoleResponse[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItemDto[]>([])
  const [isLoading, setIsLoading] = useState(canReadRoles)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<PeopleAccessTab>("users")

  const loadRolesBundle = useCallback(async () => {
    if (!canReadRoles) {
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
  }, [canReadRoles, t])

  useEffect(() => {
    void loadRolesBundle()
  }, [loadRolesBundle])

  const tabItems: { id: PeopleAccessTab; labelKey: string }[] = [
    { id: "users", labelKey: "peopleAccess.tabs.users" },
    ...(canReadCustomers
      ? [{ id: "customers" as const, labelKey: "peopleAccess.tabs.customers" }]
      : []),
    ...(canReadRoles
      ? [{ id: "roles" as const, labelKey: "peopleAccess.tabs.roles" }]
      : []),
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        icon={Users}
        title={t("peopleAccess.title")}
        description={t("peopleAccess.description")}
        className="mb-0 sm:mb-0"
      />

      <div>
        <div className="border-b border-border">
          <nav
            className="-mb-px flex gap-6 overflow-x-auto sm:gap-8"
            aria-label={t("peopleAccess.title")}
          >
            {tabItems.map((item) => {
              const isActive = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id)
                  }}
                  className={cn(
                    "border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {loadError !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {canReadRoles && isLoading ? (
        <PageContentSkeleton rows={4} />
      ) : (
        <div>
          {tab === "users" ? <PeopleUsersTab roles={roles} /> : null}

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
      )}
    </div>
  )
}
