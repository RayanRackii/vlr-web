import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, UserPlus, Users } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { EmptyStateProps } from "@/components/ui/empty-state"
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
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DIRECTORY_PAGE_SIZE,
  PeoplePager,
  PeopleSearchForm,
} from "@/features/users/components/PeopleDirectoryControls"
import { useModuleIntroLink } from "@/hooks/useModuleIntroLink"
import { Can } from "@/features/users/permissions/Can"
import {
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
  const learnMore = useModuleIntroLink("peoplePortal")
  const { currentUser, refresh, can } = usePermissions()
  const [members, setMembers] = useState<TenantMember[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [searchError, setSearchError] = useState<string | null>(null)
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

  const inviteValues = useWatch({ control: inviteForm.control })
  const isInviteValid = inviteSchema.safeParse(inviteValues).success
  const assignValues = useWatch({ control: assignForm.control })
  const isAssignValid = assignSchema.safeParse(assignValues).success

  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await listTenantMembers({
        q: appliedQuery.length >= 2 ? appliedQuery : undefined,
        page,
        pageSize: DIRECTORY_PAGE_SIZE,
      })
      setMembers(data.items)
      setTotal(data.total)
    } catch (error: unknown) {
      setMembers([])
      setTotal(0)
      setLoadError(
        error instanceof Error
          ? error.message
          : t("peopleAccess.errors.loadUsers"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [appliedQuery, page, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the directory when its server query changes.
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
      if (
        error instanceof Error &&
        error.message === "A user with this email already exists for the tenant."
      ) {
        const message = t("peopleAccess.validation.duplicateEmail")
        inviteForm.setError("email", { type: "server", message })
        toast.error(message)
        return
      }
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

  function submitSearch() {
    const next = query.trim()
    if (next.length === 1) {
      setSearchError(t("peopleAccess.users.searchTooShort"))
      return
    }

    setSearchError(null)
    setPage(1)
    setAppliedQuery(next)
  }

  function openInvite() {
    inviteForm.reset({ fullName: "", email: "", roleIds: [] })
    inviteForm.clearErrors()
    setInviteOpen(true)
  }

  function openAssign(member: TenantMember) {
    setAssigning(member)
    assignForm.reset({
      roleIds: member.roles.map((role) => role.id),
    })
    assignForm.clearErrors()
  }

  const from = total === 0 ? 0 : (page - 1) * DIRECTORY_PAGE_SIZE + 1
  const to = Math.min(page * DIRECTORY_PAGE_SIZE, total)

  const empty: EmptyStateProps = {
    icon: Users,
    title: t(appliedQuery ? "emptyStates.noResults" : "peopleAccess.users.empty"),
    description: t(appliedQuery ? "emptyStates.filterDescription" : "peopleAccess.users.emptyDescription"),
    example: !appliedQuery && can("core.users.invite") ? t("emptyStates.examples.users") : undefined,
    learnMore: appliedQuery ? undefined : learnMore,
    action: appliedQuery ? (
      <Button onClick={() => { setQuery(""); setAppliedQuery(""); setSearchError(null); setPage(1) }}>{t("emptyStates.clearSearch")}</Button>
    ) : (
      <Can permission="core.users.invite"><Button onClick={openInvite}>{t("peopleAccess.users.invite")}</Button></Can>
    ),
  }

  function identity(member: TenantMember) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold uppercase text-accent-foreground" aria-hidden>{member.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
        <div className="min-w-0">
          <p className="font-semibold [overflow-wrap:anywhere]">{member.fullName}</p>
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{member.email}</p>
        </div>
      </div>
    )
  }

  function roleChips(member: TenantMember) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {member.roles.length > 0
          ? member.roles.map((role) => <span className="break-words rounded-lg bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground" key={role.id}>{role.name}</span>)
          : <span className="text-sm italic text-muted-foreground">{t("peopleAccess.users.noRoles")}</span>}
      </div>
    )
  }

  function statusBadge(member: TenantMember) {
    return (
      <Badge className="h-auto min-h-6 gap-1.5 px-2.5 py-0.5 text-xs font-semibold" variant={member.isActive ? "success" : "secondary"}>
        <span className="inline-block size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
        {t(member.isActive ? "peopleAccess.status.active" : "peopleAccess.status.inactive")}
      </Badge>
    )
  }

  function assignAction(member: TenantMember, fullWidth = false) {
    return (
      <Can permission="core.users.assign_roles">
        <Button type="button" variant="outline" size="sm" className={fullWidth ? "h-auto min-h-11 w-full whitespace-normal text-xs" : "min-h-11 text-xs"} aria-label={t("peopleAccess.users.assign")} onClick={() => { openAssign(member) }}>
          <KeyRound aria-hidden strokeWidth={1.75} />
          <span>{t("peopleAccess.users.assign")}</span>
        </Button>
      </Can>
    )
  }

  const columns: DataListColumn<TenantMember>[] = [
    { id: "name", header: t("peopleAccess.users.fullName"), cell: identity },
    { id: "roles", header: t("peopleAccess.columns.roles"), cell: roleChips },
    { id: "status", header: t("peopleAccess.columns.status"), cell: statusBadge },
    { id: "actions", header: t("peopleAccess.columns.actions"), align: "end", cell: (member) => assignAction(member) },
  ]

  return (
    <div className="space-y-6">
      <PeopleSearchForm
        actions={
          <Can permission="core.users.invite">
            <Button
              type="button"
              size="sm"
              className="people-invite"
              onClick={openInvite}
            >
              <UserPlus aria-hidden strokeWidth={1.75} />
              {t("peopleAccess.users.invite")}
            </Button>
          </Can>
        }
        id="team-member-search"
        label={t("peopleAccess.users.searchLabel")}
        placeholder={t("peopleAccess.users.searchPlaceholder")}
        actionLabel={t("peopleAccess.users.searchAction")}
        value={query}
        error={searchError}
        onValueChange={setQuery}
        onSubmit={submitSearch}
      />

      <DataList<TenantMember>
        {...(loadError !== null
          ? { state: "error" as const, error: loadError, onRetry: () => { void loadMembers() } }
          : { state: isLoading ? ("loading" as const) : ("ready" as const) })}
        label={t("peopleAccess.tabs.users")}
        columns={columns}
        rows={members}
        getRowId={(member) => member.id}
        heading={
          <>
            <h2 className="font-semibold text-foreground">{t("peopleAccess.users.teamCount", { count: total })}</h2>
            <p className="hidden sm:block">{t("peopleAccess.users.description")}</p>
          </>
        }
        empty={empty}
        renderCard={(member) => (
          <>
            <div className="flex items-start justify-between gap-3">
              {identity(member)}
              {statusBadge(member)}
            </div>
            {roleChips(member)}
            {assignAction(member, true)}
          </>
        )}
      />

        {!isLoading && loadError === null ? (
          <PeoplePager page={page} pageSize={DIRECTORY_PAGE_SIZE} total={total}
            summary={t("peopleAccess.pagination.summary", { from, to, total })}
            previousLabel={t("peopleAccess.pagination.previous")} nextLabel={t("peopleAccess.pagination.next")} onPageChange={setPage} />
        ) : null}

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
                          <div key={role.id} className="flex min-w-0 items-center gap-3 py-1">
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              disabled={inviteForm.formState.isSubmitting}
                              onChange={() => {
                                field.onChange(toggleUniqueId(field.value, role.id))
                              }}
                            />
                            <Label htmlFor={inputId} className="min-w-0 break-words font-normal [overflow-wrap:anywhere]">
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
                <FormPrimaryButton
                  type="submit"
                  isValid={isInviteValid}
                  loading={inviteForm.formState.isSubmitting}
                >
                  {t("peopleAccess.users.sendInvite")}
                </FormPrimaryButton>
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
                          <div key={role.id} className="flex min-w-0 items-center gap-3 py-1">
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              disabled={assignForm.formState.isSubmitting}
                              onChange={() => {
                                field.onChange(toggleUniqueId(field.value, role.id))
                              }}
                            />
                            <Label htmlFor={inputId} className="min-w-0 break-words font-normal [overflow-wrap:anywhere]">
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
                <FormPrimaryButton
                  type="submit"
                  isValid={isAssignValid}
                  loading={assignForm.formState.isSubmitting}
                >
                  {t("peopleAccess.users.saveRoles")}
                </FormPrimaryButton>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
