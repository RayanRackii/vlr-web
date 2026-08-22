import { ExternalLink, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
import {
  refreshAuthSession,
  writeActiveTenantLabel,
} from "@/features/admin/hooks/usePlatformTenantSession"
import { enterTenantEnvironment } from "@/features/admin/services/adminTenantsService"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { tenantPortalHref } from "@/features/tenantPortal/services/tenantPortalService"
import { cn } from "@/lib/utils"

type TenantAdminCardProps = {
  tenant: TenantAdmin
  moduleLabelKey: (moduleName: string) => string
  isDeleting: boolean
  deleteError: string | null
  onConfirmDelete: (tenant: TenantAdmin) => void
  onDeleteDialogOpenChange: (open: boolean) => void
  isDeleteDialogOpen: boolean
}

export function TenantAdminCard({
  tenant,
  moduleLabelKey,
  isDeleting,
  deleteError,
  onConfirmDelete,
  onDeleteDialogOpenChange,
  isDeleteDialogOpen,
}: TenantAdminCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isEntering, setIsEntering] = useState(false)

  async function handleOpenEnvironment() {
    if (isEntering || !tenant.isActive) {
      return
    }

    setIsEntering(true)
    try {
      const result = await enterTenantEnvironment(tenant.id)
      writeActiveTenantLabel(result.legalName)
      await refreshAuthSession()
      void navigate("/dashboard", { replace: true })
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : t("admin.support.enterFailed")
      toast.error(t("admin.support.enterErrorTitle"), { description: message })
    } finally {
      setIsEntering(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{tenant.legalName}</CardTitle>

          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={tenant.isActive ? "success" : "secondary"}>
              {tenant.isActive
                ? t("admin.dashboard.statusActive")
                : t("admin.dashboard.statusInactive")}
            </Badge>

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!tenant.isActive || isEntering}
                aria-label={t("admin.dashboard.actions.openEnvironment")}
                title={t("admin.dashboard.actions.openEnvironment")}
                onClick={() => {
                  void handleOpenEnvironment()
                }}
              >
                <ExternalLink className="size-4 text-muted-foreground transition-colors hover:text-foreground" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("admin.dashboard.actions.edit")}
                onClick={() => {
                  void navigate(`/admin/tenants/${tenant.id}/edit`)
                }}
              >
                <Pencil className="size-4 text-muted-foreground transition-colors hover:text-foreground" />
              </Button>

              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={onDeleteDialogOpenChange}
              >
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("admin.dashboard.actions.delete")}
                    />
                  }
                >
                  <Trash2
                    className={cn(
                      "size-4 text-muted-foreground transition-colors",
                      "hover:text-destructive",
                    )}
                  />
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("admin.dashboard.delete.title")}
                    </AlertDialogTitle>
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
                        onConfirmDelete(tenant)
                      }}
                    >
                      {isDeleting
                        ? t("admin.dashboard.delete.deleting")
                        : t("admin.dashboard.delete.confirm")}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <CardDescription className="font-mono text-xs">
          {tenant.subdomain
            ? tenantPortalHref(tenant.subdomain)
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
                {t(
                  moduleLabelKey(module.moduleName) as "admin.modules.Inventory",
                )}
              </Badge>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
