import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { PermissionKeyGroups } from "@/features/users/components/PermissionKeyGroups"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"
import { Can } from "@/features/users/permissions/Can"
import { toggleUniqueId } from "@/features/users/permissions/hasPermission"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  getRoleEditorPolicy,
  listVisibleRoles,
} from "@/features/users/permissions/rolePolicy"
import {
  createRoleFormSchema,
  type PermissionCatalogItemDto,
  type RoleFormValues,
  type RoleResponse,
} from "@/features/users/schemas/roleSchemas"
import {
  createRole,
  deleteRole,
  patchRole,
  replaceRolePermissions,
} from "@/features/users/services/rolesService"

type PeopleRolesTabProps = {
  roles: readonly RoleResponse[]
  catalog: readonly PermissionCatalogItemDto[]
  onRolesChanged: () => Promise<void>
}

export function PeopleRolesTab({
  roles,
  catalog,
  onRolesChanged,
}: PeopleRolesTabProps) {
  const { t } = useTranslation()
  const { can, activeModules, refresh } = usePermissions()
  const canManage = can("core.roles.manage")
  const visibleRoles = useMemo(() => listVisibleRoles(roles), [roles])

  const [editorRole, setEditorRole] = useState<RoleResponse | null | "create">(
    null,
  )
  const [rolePendingDelete, setRolePendingDelete] =
    useState<RoleResponse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const schema = useMemo(
    () =>
      createRoleFormSchema({
        nameRequired: t("peopleAccess.validation.roleNameRequired"),
      }),
    [t],
  )

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      permissionKeys: [],
    },
  })

  const editingRole = editorRole === "create" ? null : editorRole
  const policy = editingRole
    ? getRoleEditorPolicy(editingRole)
    : {
        canRename: true,
        canDelete: true,
        canEditPermissions: true,
        isFullyReadonly: false,
        kind: "custom" as const,
      }

  const permissionsLocked =
    policy.isFullyReadonly || !policy.canEditPermissions || !canManage
  const nameLocked = editorRole !== "create" && !policy.canRename

  function openCreate() {
    setEditorRole("create")
    form.reset({ name: "", description: "", permissionKeys: [] })
    form.clearErrors()
  }

  function openEdit(role: RoleResponse) {
    setEditorRole(role)
    form.reset({
      name: role.name,
      description: role.description ?? "",
      permissionKeys: [...role.permissionKeys],
    })
    form.clearErrors()
  }

  async function handleSave(values: RoleFormValues) {
    try {
      if (editorRole === "create") {
        await createRole({
          name: values.name,
          description: values.description,
          permissionKeys: values.permissionKeys,
        })
        toast.success(t("peopleAccess.toasts.roleCreated"))
      } else if (editingRole && policy.kind === "custom") {
        await patchRole(editingRole.id, {
          name: values.name,
          description: values.description?.trim()
            ? values.description.trim()
            : null,
          permissionKeys: values.permissionKeys,
        })
        toast.success(t("peopleAccess.toasts.roleUpdated"))
      } else if (editingRole && policy.canEditPermissions) {
        await replaceRolePermissions(editingRole.id, values.permissionKeys)
        toast.success(t("peopleAccess.toasts.roleUpdated"))
      }

      setEditorRole(null)
      await onRolesChanged()
      await refresh()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.updateRole"),
      )
    }
  }

  async function handleDelete() {
    if (!rolePendingDelete) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteRole(rolePendingDelete.id)
      toast.success(t("peopleAccess.toasts.roleDeleted"))
      setRolePendingDelete(null)
      if (editingRole?.id === rolePendingDelete.id) {
        setEditorRole(null)
      }
      await onRolesChanged()
      await refresh()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.deleteRole"),
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
        />
      ) : (
        <ul className="space-y-2">
          {visibleRoles.map((role) => {
            const itemPolicy = getRoleEditorPolicy(role)

            return (
              <li
                key={role.id}
                className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{role.name}</p>
                    <Badge
                      variant={role.isSystemRole ? "secondary" : "outline"}
                    >
                      {role.isSystemRole
                        ? t("peopleAccess.badges.system")
                        : t("peopleAccess.badges.custom")}
                    </Badge>
                  </div>
                  {role.description ? (
                    <p className="text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openEdit(role)
                    }}
                  >
                    {itemPolicy.isFullyReadonly
                      ? t("peopleAccess.roles.view")
                      : t("common.edit")}
                  </Button>
                  {itemPolicy.canDelete && canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRolePendingDelete(role)
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet
        open={editorRole !== null}
        onOpenChange={(open) => {
          if (form.formState.isSubmitting) {
            return
          }
          if (!open) {
            setEditorRole(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle>
              {editorRole === "create"
                ? t("peopleAccess.roles.createTitle")
                : t("peopleAccess.roles.editTitle")}
            </SheetTitle>
            <SheetDescription>
              {policy.isFullyReadonly
                ? t("peopleAccess.roles.adminReadonly")
                : t("peopleAccess.roles.editorDescription")}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              className="flex flex-1 flex-col gap-4 px-4 pb-4"
              onSubmit={(event) => {
                void form.handleSubmit(handleSave)(event)
              }}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.role")}</FormLabel>
                    <FormControl>
                      <Input
                        disabled={nameLocked || form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.roles.descriptionLabel")}</FormLabel>
                    <FormControl>
                      <Textarea
                        disabled={nameLocked || form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissionKeys"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.permissions")}</FormLabel>
                    <PermissionKeyGroups
                      catalog={catalog}
                      activeModules={activeModules}
                      selectedKeys={field.value}
                      disabled={
                        permissionsLocked || form.formState.isSubmitting
                      }
                      onToggle={(key) => {
                        field.onChange(toggleUniqueId(field.value, key))
                      }}
                    />
                  </FormItem>
                )}
              />

              {!policy.isFullyReadonly && canManage ? (
                <LoadingButton
                  type="submit"
                  loading={form.formState.isSubmitting}
                >
                  {t("peopleAccess.roles.save")}
                </LoadingButton>
              ) : null}
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={rolePendingDelete !== null}
        onOpenChange={(open) => {
          if (isDeleting) {
            return
          }
          if (!open) {
            setRolePendingDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("peopleAccess.roles.deleteTitle")}
            </AlertDialogTitle>
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
