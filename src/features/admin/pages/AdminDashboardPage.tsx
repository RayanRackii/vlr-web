import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"

import { TenantOnboardingWizard } from "@/features/admin/components/TenantOnboardingWizard"
import { getTenantBaseDomain } from "@/features/admin/hooks/usePlatformAdmin"
import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
import { listAdminTenants } from "@/features/admin/services/adminTenantsService"
import { Badge } from "@/components/ui/badge"
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
  const { t } = useTranslation()
  const baseDomain = getTenantBaseDomain()
  const [tenants, setTenants] = useState<TenantAdmin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isWizardOpen, setIsWizardOpen] = useState(false)

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
            setIsWizardOpen(true)
          }}
        >
          <Plus className="size-4" />
          {t("admin.dashboard.newClient")}
        </Button>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
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
            <Card key={tenant.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{tenant.legalName}</CardTitle>
                  <Badge variant={tenant.isActive ? "success" : "secondary"}>
                    {tenant.isActive
                      ? t("admin.dashboard.statusActive")
                      : t("admin.dashboard.statusInactive")}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs">
                  {tenant.subdomain
                    ? `${tenant.subdomain}.${baseDomain}`
                    : t("admin.dashboard.noSubdomain")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {t("admin.dashboard.taxId")}: {tenant.taxId}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tenant.activeModules.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {t("admin.dashboard.noModules")}
                    </span>
                  ) : (
                    tenant.activeModules.map((module) => (
                      <Badge key={module.moduleName} variant="outline">
                        {t(moduleLabelKey(module.moduleName) as "admin.modules.Inventory")}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <TenantOnboardingWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        onCreated={() => {
          void loadTenants()
        }}
      />
    </div>
  )
}
