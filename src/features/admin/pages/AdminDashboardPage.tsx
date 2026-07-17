import { useCallback, useEffect, useState } from "react"
import { Building2, CircleCheck, CircleDollarSign, Plus, Power } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { TenantAdminCard } from "@/features/admin/components/TenantAdminCard"
import { getTenantBaseDomain } from "@/features/admin/hooks/usePlatformAdmin"
import {
  PRICE_PER_MODULE_BRL,
  type TenantAdmin,
} from "@/features/admin/schemas/adminTenantSchemas"
import {
  deleteAdminTenant,
  listAdminTenants,
} from "@/features/admin/services/adminTenantsService"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { isAxiosError } from "@/lib/api"

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

function moduleLabelKey(moduleName: string): string {
  const normalized = moduleName.toLowerCase()

  if (normalized === "inventory") {
    return "admin.modules.Inventory"
  }

  if (normalized === "pmoc") {
    return "admin.modules.PMOC"
  }

  if (normalized === "os") {
    return "admin.modules.OS"
  }

  if (normalized === "rentals") {
    return "admin.modules.Rentals"
  }

  return "admin.modules.unknown"
}

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const baseDomain = getTenantBaseDomain()
  const [tenants, setTenants] = useState<TenantAdmin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tenantPendingDelete, setTenantPendingDelete] =
    useState<TenantAdmin | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
          ? error.message
          : t("admin.dashboard.delete.failed")

      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
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

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      {!isLoading && !loadError ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {t("admin.dashboard.metrics.totalTenants")}
              </CardTitle>
              <Building2 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{tenants.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {t("admin.dashboard.metrics.activeTenants")}
              </CardTitle>
              <Power className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{activeTenantCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">
                {t("admin.dashboard.metrics.estimatedRevenue")}
              </CardTitle>
              <CircleDollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                {new Intl.NumberFormat(i18n.language, {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(estimatedMonthlyRevenue)}
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

      {!isLoading && tenants.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <TenantAdminCard
              key={tenant.id}
              tenant={tenant}
              baseDomain={baseDomain}
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
