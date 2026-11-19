import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Building2,
  CircleCheck,
  CircleDollarSign,
  Copy,
  Landmark,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { StatusChips } from "@/components/data-table/StatusChips"
import { Page } from "@/components/layout/Page"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/ui/status"
import { useEnterTenantEnvironment } from "@/features/admin/hooks/useEnterTenantEnvironment"
import { moduleNameI18nKey } from "@/features/admin/moduleCatalog"
import {
  PRICE_PER_MODULE_BRL,
  type TenantAdmin,
} from "@/features/admin/schemas/adminTenantSchemas"
import {
  deleteAdminTenant,
  listAdminTenants,
} from "@/features/admin/services/adminTenantsService"
import { tenantPortalHref } from "@/features/tenantPortal/services/tenantPortalService"
import { isAxiosError } from "@/lib/api"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import type { TFunction } from "i18next"

const MAX_VISIBLE_MODULES = 3

type StatusFilter = "active" | "inactive"

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

export function AdminDashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<TenantAdmin[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [tenantPendingDelete, setTenantPendingDelete] =
    useState<TenantAdmin | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const { enteringId, enter: handleOpenEnvironment } = useEnterTenantEnvironment()

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredTenants = useMemo(
    () =>
      tenants.filter((tenant) => {
        if (statusFilter !== null && tenant.isActive !== (statusFilter === "active")) {
          return false
        }
        if (!normalizedSearch) {
          return true
        }
        return [tenant.legalName, tenant.subdomain ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        )
      }),
    [normalizedSearch, statusFilter, tenants],
  )

  const activeTenantCount = tenants.filter((tenant) => tenant.isActive).length
  const inactiveTenantCount = tenants.length - activeTenantCount
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

  function openDeleteDialog(tenant: TenantAdmin) {
    setTenantPendingDelete(tenant)
    setDeleteError(null)
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open) {
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

  function tenantUrl(tenant: TenantAdmin): string | null {
    return tenant.subdomain ? tenantPortalHref(tenant.subdomain) : null
  }

  async function handleCopyUrl(tenant: TenantAdmin) {
    const url = tenantUrl(tenant)
    if (!url) {
      return
    }
    const absolute = url.startsWith("/") ? `${window.location.origin}${url}` : url
    try {
      await navigator.clipboard.writeText(absolute)
      toast.success(t("admin.dashboard.actions.copyUrlDone"))
    } catch {
      toast.error(t("admin.dashboard.actions.copyUrlFailed"))
    }
  }

  function clientCell(tenant: TenantAdmin) {
    return (
      <div className="min-w-0">
        <p className="font-medium text-foreground [overflow-wrap:anywhere]">{tenant.legalName}</p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={tenantUrl(tenant) ?? undefined}
        >
          {tenant.subdomain ?? t("admin.dashboard.noSubdomain")}
        </p>
      </div>
    )
  }

  function modulesCell(tenant: TenantAdmin) {
    const modules = tenant.activeModules
    if (modules.length === 0) {
      return (
        <span className="text-xs text-muted-foreground">
          {t("admin.dashboard.noModules")}
        </span>
      )
    }
    const label = (moduleName: string) =>
      t(moduleNameI18nKey(moduleName) as "admin.modules.Inventory")
    const hidden = modules.slice(MAX_VISIBLE_MODULES)
    return (
      <div className="flex flex-wrap gap-1.5">
        {modules.slice(0, MAX_VISIBLE_MODULES).map((module) => (
          <Badge key={module.moduleName} variant="outline">
            {label(module.moduleName)}
          </Badge>
        ))}
        {hidden.length > 0 ? (
          <Badge
            variant="secondary"
            title={hidden.map((module) => label(module.moduleName)).join(", ")}
          >
            +{hidden.length}
          </Badge>
        ) : null}
      </div>
    )
  }

  function statusCell(tenant: TenantAdmin) {
    return (
      <StatusBadge tone={tenant.isActive ? "success" : "neutral"}>
        {tenant.isActive
          ? t("admin.dashboard.statusActive")
          : t("admin.dashboard.statusInactive")}
      </StatusBadge>
    )
  }

  function actionsCell(tenant: TenantAdmin) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!tenant.isActive || enteringId !== null}
          onClick={() => {
            void handleOpenEnvironment(tenant)
          }}
        >
          {t("admin.dashboard.actions.openEnvironment")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={t("admin.dashboard.actions.rowMenu", { name: tenant.legalName })}
              />
            }
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="min-h-11 py-2.5"
              onClick={() => {
                void navigate(`/admin/tenants/${tenant.id}/edit`)
              }}
            >
              <Pencil aria-hidden="true" />
              {t("admin.dashboard.actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11 py-2.5"
              onClick={() => {
                void navigate(`/admin/tenants/${tenant.id}/recursos-visuais`)
              }}
            >
              <Palette aria-hidden="true" />
              {t("admin.dashboard.actions.visualResources")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11 py-2.5"
              disabled={!tenant.subdomain}
              onClick={() => {
                void handleCopyUrl(tenant)
              }}
            >
              <Copy aria-hidden="true" />
              {t("admin.dashboard.actions.copyUrl")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="min-h-11 py-2.5"
              onClick={() => {
                openDeleteDialog(tenant)
              }}
            >
              <Trash2 aria-hidden="true" />
              {t("admin.dashboard.actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  const columns: DataListColumn<TenantAdmin>[] = [
    { id: "client", header: t("admin.dashboard.columns.client"), cell: clientCell },
    { id: "modules", header: t("admin.dashboard.columns.modules"), cell: modulesCell },
    {
      id: "taxId",
      header: t("admin.dashboard.taxId"),
      hideBelow: "lg",
      className: "whitespace-nowrap text-muted-foreground",
      cell: (tenant) => tenant.taxId,
    },
    { id: "status", header: t("admin.dashboard.columns.status"), cell: statusCell },
    {
      id: "actions",
      header: t("admin.dashboard.columns.actions"),
      align: "end",
      cell: actionsCell,
    },
  ]

  const hasFilters = normalizedSearch !== "" || statusFilter !== null
  function clearFilters() {
    setSearchQuery("")
    setStatusFilter(null)
  }

  const toolbar =
    tenants.length > 0 ? (
      <FilterBar
        label={t("admin.dashboard.searchLabel")}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          label: t("admin.dashboard.searchLabel"),
          placeholder: t("admin.dashboard.searchPlaceholder"),
        }}
        filters={
          <StatusChips<StatusFilter>
            label={t("admin.dashboard.columns.status")}
            allLabel={t("admin.dashboard.filterAll")}
            allCount={tenants.length}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "active", label: t("admin.dashboard.statusActive"), tone: "success", count: activeTenantCount },
              { value: "inactive", label: t("admin.dashboard.statusInactive"), tone: "neutral", count: inactiveTenantCount },
            ]}
          />
        }
      />
    ) : null

  const empty =
    tenants.length === 0
      ? {
          icon: Landmark,
          title: t("admin.dashboard.emptyTitle"),
          description: t("admin.dashboard.emptyDescription"),
        }
      : {
          icon: Landmark,
          title: t("admin.dashboard.searchEmptyTitle"),
          description: t("admin.dashboard.searchEmptyDescription"),
          action: hasFilters ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={clearFilters}>
              {t("admin.dashboard.clearSearch")}
            </Button>
          ) : undefined,
        }

  return (
    <Page
      width="wide"
      header={{
        title: t("admin.dashboard.title"),
        description: t("admin.dashboard.description"),
        actions: (
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
        ),
      }}
    >
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

      <DataList<TenantAdmin>
        {...(loadError !== null
          ? { state: "error" as const, error: loadError, onRetry: () => { void loadTenants() } }
          : { state: isLoading ? ("loading" as const) : ("ready" as const) })}
        label={t("admin.dashboard.title")}
        toolbar={toolbar}
        columns={columns}
        rows={filteredTenants}
        getRowId={(tenant) => tenant.id}
        empty={empty}
        renderCard={(tenant) => (
          <>
            <div className="flex min-w-0 items-start justify-between gap-3">
              {clientCell(tenant)}
              {statusCell(tenant)}
            </div>
            {modulesCell(tenant)}
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {t("admin.dashboard.taxId")}: {tenant.taxId}
            </p>
            {actionsCell(tenant)}
          </>
        )}
      />

      <AlertDialog
        open={tenantPendingDelete !== null}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.dashboard.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.dashboard.delete.description")}
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
                if (tenantPendingDelete) {
                  void handleConfirmDelete(tenantPendingDelete)
                }
              }}
            >
              {isDeleting
                ? t("admin.dashboard.delete.deleting")
                : t("admin.dashboard.delete.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
