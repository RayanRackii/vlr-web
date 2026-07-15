import { Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import type { TenantAdmin } from "@/features/admin/schemas/adminTenantSchemas"
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
import { cn } from "@/lib/utils"

type TenantAdminCardProps = {
  tenant: TenantAdmin
  baseDomain: string
  moduleLabelKey: (moduleName: string) => string
  isDeleting: boolean
  deleteError: string | null
  onConfirmDelete: (tenant: TenantAdmin) => void
  onDeleteDialogOpenChange: (open: boolean) => void
  isDeleteDialogOpen: boolean
}

export function TenantAdminCard({
  tenant,
  baseDomain,
  moduleLabelKey,
  isDeleting,
  deleteError,
  onConfirmDelete,
  onDeleteDialogOpenChange,
  isDeleteDialogOpen,
}: TenantAdminCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

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
