import { useMemo, useState } from "react"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { QuickEditSheet } from "@/components/ui/quick-edit-sheet"
import { Textarea } from "@/components/ui/textarea"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"
import { useModuleIntroLink } from "@/hooks/useModuleIntroLink"
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
import { createRole, deleteRole } from "@/features/users/services/rolesService"

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

  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rolePendingDelete, setRolePendingDelete] = useState<RoleResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function openCreate() {
    actionTriggerRef.current = null
    setCreateName("")
    setCreateDescription("")
    setCreating(true)
  }

  function openEdit(role: RoleResponse) {
    void navigate(`/pessoas-e-acesso/funcoes/${role.id}`)
  }

  async function handleCreate() {
    if (createName.trim().length < 2) return
    setIsSubmitting(true)
    try {
      const created = await createRole({
        name: createName.trim(),
        description: createDescription.trim() ? createDescription.trim() : undefined,
        permissionKeys: [],
      })
      toast.success(t("peopleAccess.toasts.roleCreated"))
      setCreating(false)
      await onRolesChanged()
      await refresh()
      void navigate(`/pessoas-e-acesso/funcoes/${created.id}?tab=permissions`)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("peopleAccess.errors.createRole"),
      )
    } finally {
      setIsSubmitting(false)
    }
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
          <Button type="button" size="sm" onClick={openCreate}>
            {t("peopleAccess.roles.create")}
          </Button>
        </Can>
      </div>

      {visibleRoles.length === 0 ? (
        <PeopleEmptyState
          icon={ShieldCheck}
          title={t("peopleAccess.roles.empty")}
          description={t("peopleAccess.roles.emptyDescription")}
          example={canManage ? t("emptyStates.examples.roles") : undefined}
          learnMore={learnMore}
          action={
            <Can permission="core.roles.manage">
              <Button onClick={openCreate}>{t("peopleAccess.roles.create")}</Button>
            </Can>
          }
        />
      ) : (
        <>
          <p className="people-actions-hint">
            <ChevronRight aria-hidden strokeWidth={1.75} />
            {t("peopleAccess.mobileActions.hint")}
          </p>
          <ul className="people-role-list">
            {visibleRoles.map((role) => {
              const itemPolicy = getRoleEditorPolicy(role)

              return (
                <li key={role.id} className="people-role-row">
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
                  <div className="people-row-actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="people-card-action"
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
                        className="people-delete-action"
                        onClick={() => {
                          setRolePendingDelete(role)
                        }}
                      >
                        {t("common.delete")}
                      </Button>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="people-row-chevron"
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
        restoreFocus={!creating}
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

      <QuickEditSheet
        open={creating}
        onOpenChange={(open) => {
          if (isSubmitting) return
          if (!open) setCreating(false)
        }}
        title={t("peopleAccess.roles.createTitle")}
        description={t("peopleAccess.roles.editorDescription")}
        onSave={() => {
          void handleCreate()
        }}
        saving={isSubmitting}
        saveDisabled={createName.trim().length < 2}
        saveLabel={t("peopleAccess.roleEditor.createContinue")}
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-role-name">{t("peopleAccess.role")}</Label>
            <Input
              id="new-role-name"
              value={createName}
              disabled={isSubmitting}
              onChange={(event) => setCreateName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-role-description">
              {t("peopleAccess.roles.descriptionLabel")}
            </Label>
            <Textarea
              id="new-role-description"
              value={createDescription}
              disabled={isSubmitting}
              onChange={(event) => setCreateDescription(event.target.value)}
            />
          </div>
        </div>
      </QuickEditSheet>

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
