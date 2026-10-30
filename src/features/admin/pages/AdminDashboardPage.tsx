import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, CircleCheck, CircleDollarSign, Plus, Power, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { TenantAdminCard } from "@/features/admin/components/TenantAdminCard"
import { moduleNameI18nKey } from "@/features/admin/moduleCatalog"
import {
  PRICE_PER_MODULE_BRL,
  type TenantAdmin,
} from "@/features/admin/schemas/adminTenantSchemas"
import {
  deleteAdminTenant,
  listAdminTenants,
} from "@/features/admin/services/adminTenantsService"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ErrorState"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { isAxiosError } from "@/lib/api"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import type { TFunction } from "i18next"

function TenantCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
      </CardContent>
    </Card>
  )
}

function mapTenantDeleteError(message: string, t: TFunction): string {
  const normalized = message.toLowerCase()

  if (normalized.includes("has users")) {
    return t("admin.dashboard.delete.errors.hasUsers")
  }

  if (normalized.includes("has units")) {
    return t("admin.dashboard.delete.errors.hasUnits")
  }

  if (normalized.includes("has roles")) {
    return t("admin.dashboard.delete.errors.hasRoles")
  }

  if (normalized.includes("linked data")) {
    return t("admin.dashboard.delete.errors.linkedData")
  }

  if (normalized.includes("not found")) {
    return t("admin.dashboard.delete.errors.notFound")
  }

  return message.trim().length > 0
    ? message
    : t("admin.dashboard.delete.failed")
}

function moduleLabelKey(moduleName: string): string {
  return moduleNameI18nKey(moduleName)
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<TenantAdmin[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tenantPendingDelete, setTenantPendingDelete] =
    useState<TenantAdmin | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredTenants = useMemo(() => {
    if (!normalizedSearch) {
      return tenants
    }

    return tenants.filter((tenant) =>
      [tenant.legalName, tenant.subdomain ?? ""].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      ),
    )
  }, [normalizedSearch, tenants])

  const activeTenantCount = tenants.filter((tenant) => tenant.isActive).length
  const estimatedMonthlyRevenue = tenants.reduce(
    (total, tenant) =>
      total +
      (tenant.isActive
        ? tenant.activeModules.filter((module) => module.isActive).length *
          PRICE_PER_MODULE_BRL
        : 0),
    0,
  )

  const loadTenants = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await listAdminTenants()
      setTenants(data)
    } catch (error: unknown) {
      console.error("AdminDashboardPage loadTenants failed", error)

      if (isAxiosError(error) && error.response?.status === 403) {
        setLoadError(t("admin.errors.forbidden"))
      } else {
        setLoadError(t("admin.errors.loadFailed"))
      }

      setTenants([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    if (!successMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [successMessage])

  function handleDeleteDialogOpenChange(tenant: TenantAdmin, open: boolean) {
    if (open) {
      setTenantPendingDelete(tenant)
      setDeleteError(null)
      return
    }

    if (tenantPendingDelete?.id === tenant.id) {
      setTenantPendingDelete(null)
      setDeleteError(null)
    }
  }

  async function handleConfirmDelete(tenant: TenantAdmin) {
    setDeleteError(null)
    setIsDeleting(true)

    try {
      await deleteAdminTenant(tenant.id)

      setTenants((current) => current.filter((item) => item.id !== tenant.id))
      setTenantPendingDelete(null)
      setSuccessMessage(t("admin.dashboard.delete.success"))
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? mapTenantDeleteError(error.message, t)
          : t("admin.dashboard.delete.failed")

      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("admin.dashboard.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.dashboard.description")}
          </p>
        </div>

        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            void navigate("/admin/tenants/new")
          }}
        >
          <Plus className="size-4" />
          {t("admin.dashboard.newClient")}
        </Button>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-green-900 dark:text-green-300"
        >
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      ) : null}

      {loadError ? <ErrorState message={loadError} onRetry={() => void loadTenants()} /> : null}

      {!isLoading && !loadError ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card className="gap-2 py-3 sm:gap-5 sm:py-5">
            <CardHeader className="flex-row items-center justify-between px-3 sm:px-5">
              <CardTitle className="text-sm">
                {t("admin.dashboard.metrics.totalTenants")}
              </CardTitle>
              <Building2 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 sm:px-5">
              <p className="text-3xl font-semibold">{tenants.length}</p>
            </CardContent>
          </Card>
          <Card className="gap-2 py-3 sm:gap-5 sm:py-5">
            <CardHeader className="flex-row items-center justify-between px-3 sm:px-5">
              <CardTitle className="text-sm">
                {t("admin.dashboard.metrics.activeTenants")}
              </CardTitle>
              <Power className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 sm:px-5">
              <p className="text-3xl font-semibold">{activeTenantCount}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 gap-2 py-3 sm:gap-5 sm:py-5 lg:col-span-1">
            <CardHeader className="flex-row items-center justify-between px-3 sm:px-5">
              <CardTitle className="text-sm">
                {t("admin.dashboard.metrics.estimatedRevenue")}
              </CardTitle>
              <CircleDollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 sm:px-5">
              <p className="text-3xl font-semibold">
                {formatLocaleCurrency(
                  estimatedMonthlyRevenue,
                  "BRL",
                  i18n.language,
                  { maximumFractionDigits: 0, minimumFractionDigits: 0 },
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <TenantCardSkeleton />
          <TenantCardSkeleton />
          <TenantCardSkeleton />
        </div>
      ) : null}

      {!isLoading && !loadError && tenants.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.dashboard.emptyTitle")}</CardTitle>
            <CardDescription>
              {t("admin.dashboard.emptyDescription")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !loadError && tenants.length > 0 ? (
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="admin-tenant-search">{t("admin.dashboard.searchLabel")}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-tenant-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("admin.dashboard.searchPlaceholder")}
              className="min-h-11 pl-9"
            />
          </div>
        </div>
      ) : null}

      {!isLoading && !loadError && tenants.length > 0 && filteredTenants.length === 0 ? (
        <Card>
          <CardHeader role="status">
            <CardTitle>{t("admin.dashboard.searchEmptyTitle")}</CardTitle>
            <CardDescription>
              {t("admin.dashboard.searchEmptyDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setSearchQuery("")}>
              {t("admin.dashboard.clearSearch")}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !loadError && filteredTenants.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTenants.map((tenant) => (
            <TenantAdminCard
              key={tenant.id}
              tenant={tenant}
              moduleLabelKey={moduleLabelKey}
              isDeleting={isDeleting && tenantPendingDelete?.id === tenant.id}
              deleteError={
                tenantPendingDelete?.id === tenant.id ? deleteError : null
              }
              isDeleteDialogOpen={tenantPendingDelete?.id === tenant.id}
              onDeleteDialogOpenChange={(open) => {
                handleDeleteDialogOpenChange(tenant, open)
              }}
              onConfirmDelete={handleConfirmDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
