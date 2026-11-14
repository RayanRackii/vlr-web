import { useMemo, useState } from "react"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import { EmptyState } from "@/components/ui/empty-state"
import { useModuleIntroLink } from "@/hooks/useModuleIntroLink"
import {
  PEOPLE_ACTIONS_HINT,
  PEOPLE_ROW_ACTIONS,
  PEOPLE_ROW_ACTION_BUTTON,
  PEOPLE_ROW_CHEVRON,
  PEOPLE_ROW_DELETE_BUTTON,
  PEOPLE_SURFACE,
} from "@/features/users/components/peopleRowStyles"
import { PeopleMobileActionSheet } from "@/features/users/components/PeopleMobileActionSheet"
import { usePeopleMobileActions } from "@/features/users/hooks/usePeopleMobileActions"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  getRoleEditorPolicy,
  listVisibleRoles,
} from "@/features/users/permissions/rolePolicy"
import type {
  PermissionCatalogItemDto,
  RoleResponse,
} from "@/features/users/schemas/roleSchemas"
import { cn } from "@/lib/utils"
import { deleteRole } from "@/features/users/services/rolesService"

type PeopleRolesTabProps = {
  roles: readonly RoleResponse[]
  catalog: readonly PermissionCatalogItemDto[]
  onRolesChanged: () => Promise<void>
}

export function PeopleRolesTab({ roles, onRolesChanged }: PeopleRolesTabProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const learnMore = useModuleIntroLink("peoplePortal")
  const { can, refresh } = usePermissions()
  const canManage = can("core.roles.manage")
  const visibleRoles = useMemo(() => listVisibleRoles(roles), [roles])
  const {
    isMobile,
    actionItem: actionRole,
    setActionItem: setActionRole,
    actionTriggerRef,
  } = usePeopleMobileActions<RoleResponse>()

  const [rolePendingDelete, setRolePendingDelete] = useState<RoleResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function openEdit(role: RoleResponse) {
    void navigate(`/pessoas-e-acesso/funcoes/${role.id}`)
  }

  async function handleDelete() {
    if (!rolePendingDelete) return
    setIsDeleting(true)
    try {
      await deleteRole(rolePendingDelete.id)
      toast.success(t("peopleAccess.toasts.roleDeleted"))
      setRolePendingDelete(null)
      setActionRole(null)
      await onRolesChanged()
      await refresh()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("peopleAccess.errors.deleteRole"),
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            {t("peopleAccess.tabs.roles")}
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {t("peopleAccess.roles.description")}
          </p>
        </div>
        <Can permission="core.roles.manage">
          <Link
            to="/pessoas-e-acesso/funcoes/nova"
            className={buttonVariants({ size: "sm" })}
          >
            {t("peopleAccess.roles.create")}
          </Link>
        </Can>
      </div>

      {visibleRoles.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t("peopleAccess.roles.empty")}
          description={t("peopleAccess.roles.emptyDescription")}
          example={canManage ? t("emptyStates.examples.roles") : undefined}
          learnMore={learnMore}
          action={
            <Can permission="core.roles.manage">
              <Link to="/pessoas-e-acesso/funcoes/nova" className={buttonVariants()}>
                {t("peopleAccess.roles.create")}
              </Link>
            </Can>
          }
        />
      ) : (
        <>
          <p className={PEOPLE_ACTIONS_HINT}>
            <ChevronRight aria-hidden strokeWidth={1.75} />
            {t("peopleAccess.mobileActions.hint")}
          </p>
          <ul className={cn(PEOPLE_SURFACE, "divide-y divide-border overflow-hidden")}>
            {visibleRoles.map((role) => {
              const itemPolicy = getRoleEditorPolicy(role)

              return (
                <li key={role.id} className="relative flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-medium [overflow-wrap:anywhere]">
                        {role.name}
                      </p>
                      <Badge variant={role.isSystemRole ? "secondary" : "outline"}>
                        {role.isSystemRole
                          ? t("peopleAccess.badges.system")
                          : t("peopleAccess.badges.custom")}
                      </Badge>
                    </div>
                    {role.description ? (
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    ) : null}
                  </div>
                  <div className={PEOPLE_ROW_ACTIONS}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={PEOPLE_ROW_ACTION_BUTTON}
                      aria-label={
                        isMobile
                          ? role.name
                          : itemPolicy.isFullyReadonly
                            ? t("peopleAccess.roles.view")
                            : t("common.edit")
                      }
                      aria-haspopup={isMobile ? "dialog" : undefined}
                      aria-expanded={isMobile ? actionRole?.id === role.id : undefined}
                      onClick={(event) => {
                        if (isMobile) {
                          actionTriggerRef.current = event.currentTarget
                          setActionRole(role)
                        } else {
                          openEdit(role)
                        }
                      }}
                    >
                      <span>
                        {itemPolicy.isFullyReadonly
                          ? t("peopleAccess.roles.view")
                          : t("common.edit")}
                      </span>
                    </Button>
                    {itemPolicy.canDelete && canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={PEOPLE_ROW_DELETE_BUTTON}
                        onClick={() => {
                          setRolePendingDelete(role)
                        }}
                      >
                        {t("common.delete")}
                      </Button>
                    ) : null}
                  </div>
                  <ChevronRight
                    className={PEOPLE_ROW_CHEVRON}
                    aria-hidden
                    strokeWidth={1.75}
                  />
                </li>
              )
            })}
          </ul>
        </>
      )}

      <PeopleMobileActionSheet
        open={isMobile && actionRole !== null}
        name={actionRole?.name ?? ""}
        description={actionRole?.description}
        icon={ShieldCheck}
        editSubtitle={t(
          actionRole?.isSystemRole
            ? "peopleAccess.mobileActions.editSystemRole"
            : "peopleAccess.mobileActions.editRole",
        )}
        deleteSubtitle={t("peopleAccess.mobileActions.deleteRole")}
        canDelete={
          actionRole !== null &&
          getRoleEditorPolicy(actionRole).canDelete &&
          canManage
        }
        locked={actionRole?.isSystemRole}
        confirming={rolePendingDelete !== null}
        confirmTitle={t("peopleAccess.roles.deleteTitle")}
        confirmDescription={t("peopleAccess.roles.deleteDescription", {
          name: rolePendingDelete?.name ?? "",
        })}
        isDeleting={isDeleting}
        returnFocus={actionTriggerRef}
        restoreFocus
        onClose={() => {
          setActionRole(null)
          setRolePendingDelete(null)
        }}
        onEdit={() => {
          if (actionRole) {
            const role = actionRole
            setActionRole(null)
            openEdit(role)
          }
        }}
        onRequestDelete={() => {
          setRolePendingDelete(actionRole)
        }}
        onConfirmDelete={() => {
          void handleDelete()
        }}
      />

      <AlertDialog
        open={rolePendingDelete !== null && (!isMobile || actionRole === null)}
        onOpenChange={(open) => {
          if (isDeleting) return
          if (!open) setRolePendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("peopleAccess.roles.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("peopleAccess.roles.deleteDescription", {
                name: rolePendingDelete?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} />
            <LoadingButton
              type="button"
              variant="destructive"
              loading={isDeleting}
              onClick={() => {
                void handleDelete()
              }}
            >
              {t("common.delete")}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
