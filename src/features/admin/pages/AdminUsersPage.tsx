import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle, Trash2, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  deletePlatformUser,
  listPlatformUsers,
  type PlatformUser,
} from "@/features/admin/services/platformUsersService"
import {
  listAdminTenants,
} from "@/features/admin/services/adminTenantsService"
import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isAxiosError } from "@/lib/api"

const ALL_TENANTS_VALUE = "__all__"

export function AdminUsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [tenants, setTenants] = useState<TenantAdmin[]>([])
  const [nameFilter, setNameFilter] = useState("")
  const [debouncedName, setDebouncedName] = useState("")
  const [tenantFilter, setTenantFilter] = useState(ALL_TENANTS_VALUE)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [userPendingDelete, setUserPendingDelete] =
    useState<PlatformUser | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const tenantItems = useMemo(
    () => [
      { value: ALL_TENANTS_VALUE, label: t("admin.platformUsers.filters.allTenants") },
      ...tenants.map((tenant) => ({
        value: tenant.id,
        label: tenant.legalName,
      })),
    ],
    [t, tenants],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedName(nameFilter.trim())
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [nameFilter])

  const loadTenants = useCallback(async () => {
    try {
      const data = await listAdminTenants()
      setTenants(data)
    } catch (error: unknown) {
      console.error("AdminUsersPage loadTenants failed", error)
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await listPlatformUsers({
        name: debouncedName || undefined,
        tenantId:
          tenantFilter === ALL_TENANTS_VALUE ? undefined : tenantFilter,
      })
      setUsers(data)
    } catch (error: unknown) {
      console.error("AdminUsersPage loadUsers failed", error)

      if (isAxiosError(error) && error.response?.status === 403) {
        setLoadError(t("admin.errors.forbidden"))
      } else if (error instanceof Error && error.message.trim().length > 0) {
        setLoadError(error.message)
      } else {
        setLoadError(t("admin.platformUsers.errors.loadFailed"))
      }

      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedName, tenantFilter, t])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  async function handleConfirmDelete() {
    if (!userPendingDelete) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deletePlatformUser(userPendingDelete.id)
      toast.success(t("admin.platformUsers.delete.successTitle"), {
        description: t("admin.platformUsers.delete.success"),
      })
      setUserPendingDelete(null)
      await loadUsers()
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.platformUsers.delete.failed")
      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("admin.platformUsers.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.platformUsers.description")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platform-users-name">
            {t("admin.platformUsers.filters.name")}
          </Label>
          <Input
            id="platform-users-name"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder={t("admin.platformUsers.filters.namePlaceholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="platform-users-tenant">
            {t("admin.platformUsers.filters.tenant")}
          </Label>
          <Select
            modal={false}
            value={tenantFilter}
            onValueChange={(value) => {
              if (typeof value === "string") {
                setTenantFilter(value)
              }
            }}
            items={tenantItems}
          >
            <SelectTrigger id="platform-users-tenant" className="w-full">
              <SelectValue
                placeholder={t("admin.platformUsers.filters.tenantPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {tenantItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.platformUsers.columns.name")}</TableHead>
              <TableHead>{t("admin.platformUsers.columns.email")}</TableHead>
              <TableHead>{t("admin.platformUsers.columns.tenant")}</TableHead>
              <TableHead>{t("admin.platformUsers.columns.roles")}</TableHead>
              <TableHead>{t("admin.platformUsers.columns.status")}</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">
                  {t("admin.platformUsers.columns.actions")}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-36" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="size-8 opacity-50" aria-hidden="true" />
                    <p className="text-sm font-medium">
                      {t("admin.platformUsers.emptyTitle")}
                    </p>
                    <p className="text-xs">
                      {t("admin.platformUsers.emptyDescription")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p>{user.tenantLegalName}</p>
                      {user.tenantSubdomain ? (
                        <p className="text-xs text-muted-foreground">
                          {user.tenantSubdomain}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "success" : "secondary"}>
                      {user.isActive
                        ? t("admin.platformUsers.statusActive")
                        : t("admin.platformUsers.statusInactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("admin.platformUsers.actions.delete")}
                      onClick={() => {
                        setDeleteError(null)
                        setUserPendingDelete(user)
                      }}
                    >
                      <Trash2 className="size-4 text-muted-foreground transition-colors hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={userPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setUserPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.platformUsers.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userPendingDelete
                ? t("admin.platformUsers.delete.description", {
                    name: userPendingDelete.fullName,
                    tenant: userPendingDelete.tenantLegalName,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} />
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleConfirmDelete()
              }}
            >
              {isDeleting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  {t("admin.platformUsers.delete.deleting")}
                </>
              ) : (
                t("admin.platformUsers.delete.confirm")
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
