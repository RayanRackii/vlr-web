import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { Can } from "@/features/users/permissions/Can"
import {
  formatAssignedRoles,
  toggleUniqueId,
} from "@/features/users/permissions/hasPermission"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { listAssignableRoles } from "@/features/users/permissions/rolePolicy"
import {
  createAssignRolesFormSchema,
  createInviteMemberFormSchema,
  type AssignRolesFormValues,
  type InviteMemberFormValues,
  type TenantMember,
} from "@/features/users/schemas/userSchemas"
import type { RoleResponse } from "@/features/users/schemas/roleSchemas"
import {
  assignUserRoles,
  inviteTenantMember,
  listTenantMembers,
} from "@/features/users/services/usersService"

type PeopleUsersTabProps = {
  roles: readonly RoleResponse[]
}

export function PeopleUsersTab({ roles }: PeopleUsersTabProps) {
  const { t } = useTranslation()
  const { currentUser, refresh } = usePermissions()
  const [members, setMembers] = useState<TenantMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [assigning, setAssigning] = useState<TenantMember | null>(null)

  const assignableRoles = useMemo(() => listAssignableRoles(roles), [roles])

  const inviteSchema = useMemo(
    () =>
      createInviteMemberFormSchema({
        fullNameRequired: t("peopleAccess.validation.fullNameRequired"),
        emailInvalid: t("peopleAccess.validation.emailInvalid"),
        rolesRequired: t("peopleAccess.validation.rolesRequired"),
      }),
    [t],
  )

  const assignSchema = useMemo(
    () =>
      createAssignRolesFormSchema({
        rolesRequired: t("peopleAccess.validation.rolesRequired"),
      }),
    [t],
  )

  const inviteForm = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      fullName: "",
      email: "",
      roleIds: [],
    },
  })

  const assignForm = useForm<AssignRolesFormValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      roleIds: [],
    },
  })

  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await listTenantMembers()
      setMembers(data)
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.loadUsers"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  async function handleInvite(values: InviteMemberFormValues) {
    try {
      await inviteTenantMember(values)
      toast.success(t("peopleAccess.toasts.inviteSuccess"))
      setInviteOpen(false)
      inviteForm.reset({ fullName: "", email: "", roleIds: [] })
      await loadMembers()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.invite"),
      )
    }
  }

  async function handleAssign(values: AssignRolesFormValues) {
    if (!assigning) {
      return
    }

    try {
      await assignUserRoles(assigning.id, values)
      toast.success(t("peopleAccess.toasts.assignSuccess"))
      if (currentUser?.id === assigning.id) {
        await refresh()
      }
      setAssigning(null)
      await loadMembers()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.assignRoles"),
      )
    }
  }

  function openAssign(member: TenantMember) {
    setAssigning(member)
    assignForm.reset({
      roleIds: member.roles.map((role) => role.id),
    })
    assignForm.clearErrors()
  }

  if (isLoading) {
    return <PageContentSkeleton rows={4} />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t("peopleAccess.users.description")}
        </p>
        <Can permission="core.users.invite">
          <Button
            type="button"
            onClick={() => {
              inviteForm.reset({ fullName: "", email: "", roleIds: [] })
              inviteForm.clearErrors()
              setInviteOpen(true)
            }}
          >
            {t("peopleAccess.users.invite")}
          </Button>
        </Can>
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {members.length === 0 && loadError === null ? (
        <p className="text-sm text-muted-foreground">
          {t("peopleAccess.users.empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border border-border">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">
                  {member.fullName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatAssignedRoles(member.roles) ||
                    t("peopleAccess.users.noRoles")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.isActive ? "success" : "secondary"}>
                  {member.isActive
                    ? t("peopleAccess.status.active")
                    : t("peopleAccess.status.inactive")}
                </Badge>
                <Can permission="core.users.assign_roles">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openAssign(member)
                    }}
                  >
                    {t("peopleAccess.users.assign")}
                  </Button>
                </Can>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          if (inviteForm.formState.isSubmitting) {
            return
          }
          setInviteOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("peopleAccess.users.inviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("peopleAccess.users.inviteDescription")}
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void inviteForm.handleSubmit(handleInvite)(event)
              }}
            >
              <FormField
                control={inviteForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.users.fullName")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        disabled={inviteForm.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.users.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        disabled={inviteForm.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="roleIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.role")}</FormLabel>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      {assignableRoles.map((role) => {
                        const inputId = `invite-role-${role.id}`
                        const checked = field.value.includes(role.id)

                        return (
                          <div key={role.id} className="flex items-center gap-2">
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              disabled={inviteForm.formState.isSubmitting}
                              onChange={() => {
                                field.onChange(toggleUniqueId(field.value, role.id))
                              }}
                            />
                            <Label htmlFor={inputId} className="font-normal">
                              {role.name}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <LoadingButton
                  type="submit"
                  loading={inviteForm.formState.isSubmitting}
                >
                  {t("peopleAccess.users.sendInvite")}
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assigning !== null}
        onOpenChange={(open) => {
          if (assignForm.formState.isSubmitting) {
            return
          }
          if (!open) {
            setAssigning(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("peopleAccess.users.assignTitle")}</DialogTitle>
            <DialogDescription>
              {assigning
                ? t("peopleAccess.users.assignDescription", {
                    name: assigning.fullName,
                  })
                : t("peopleAccess.users.assign")}
            </DialogDescription>
          </DialogHeader>
          <Form {...assignForm}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                void assignForm.handleSubmit(handleAssign)(event)
              }}
            >
              <FormField
                control={assignForm.control}
                name="roleIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("peopleAccess.accessProfile")}</FormLabel>
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      {assignableRoles.map((role) => {
                        const inputId = `assign-role-${role.id}`
                        const checked = field.value.includes(role.id)

                        return (
                          <div key={role.id} className="flex items-center gap-2">
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              disabled={assignForm.formState.isSubmitting}
                              onChange={() => {
                                field.onChange(toggleUniqueId(field.value, role.id))
                              }}
                            />
                            <Label htmlFor={inputId} className="font-normal">
                              {role.name}
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <LoadingButton
                  type="submit"
                  loading={assignForm.formState.isSubmitting}
                >
                  {t("peopleAccess.users.saveRoles")}
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
