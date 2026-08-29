import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

export function PeopleAccessPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canReadRoles = can("core.roles.read")

  const [roles, setRoles] = useState<RoleResponse[]>([])
  const [catalog, setCatalog] = useState<PermissionCatalogItemDto[]>([])
  const [isLoading, setIsLoading] = useState(canReadRoles)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState("users")

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("peopleAccess.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("peopleAccess.description")}
        </p>
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {canReadRoles && isLoading ? (
        <PageContentSkeleton rows={4} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value === "users" || value === "roles") {
              setTab(value)
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="users">
              {t("peopleAccess.tabs.users")}
            </TabsTrigger>
            {canReadRoles ? (
              <TabsTrigger value="roles">
                {t("peopleAccess.tabs.roles")}
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <PeopleUsersTab roles={roles} />
          </TabsContent>

          {canReadRoles ? (
            <TabsContent value="roles" className="mt-4">
              <PeopleRolesTab
                roles={roles}
                catalog={catalog}
                onRolesChanged={loadRolesBundle}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  )
}
