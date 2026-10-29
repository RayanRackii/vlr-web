import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, UserPlus, Users } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DIRECTORY_PAGE_SIZE,
  PeoplePager,
  PeopleSearchForm,
} from "@/features/users/components/PeopleDirectoryControls"
import { PeopleEmptyState } from "@/features/users/components/PeopleEmptyState"
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

      {isLoading ? <PageContentSkeleton rows={4} /> : null}

      {loadError !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <section className="people-directory" aria-label={t("peopleAccess.tabs.users")}>
        <div className="people-list-heading">
          {!isLoading ? <h2>{t("peopleAccess.users.teamCount", { count: total })}</h2> : null}
          <p>{t("peopleAccess.users.description")}</p>
        </div>
        {!isLoading && members.length === 0 && loadError === null ? (
          <PeopleEmptyState
            icon={Users}
            title={t(appliedQuery ? "emptyStates.noResults" : "peopleAccess.users.empty")}
            description={t(appliedQuery ? "emptyStates.filterDescription" : "peopleAccess.users.emptyDescription")}
            example={!appliedQuery && can("core.users.invite") ? t("emptyStates.examples.users") : undefined}
            learnMore={appliedQuery ? undefined : learnMore}
            action={appliedQuery ? (
              <Button onClick={() => { setQuery(""); setAppliedQuery(""); setSearchError(null); setPage(1) }}>{t("emptyStates.clearSearch")}</Button>
            ) : (
              <Can permission="core.users.invite"><Button onClick={openInvite}>{t("peopleAccess.users.invite")}</Button></Can>
            )}
          />
        ) : members.length > 0 ? (
          <table className="people-table people-team-table" aria-label={t("peopleAccess.tabs.users")}>
            <thead><tr>
              <th scope="col">{t("peopleAccess.users.fullName")}</th>
              <th scope="col">{t("peopleAccess.columns.roles")}</th>
              <th scope="col">{t("peopleAccess.columns.status")}</th>
              <th scope="col" className="people-actions-heading">{t("peopleAccess.columns.actions")}</th>
            </tr></thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="people-identity-cell">
                    <div className="people-person">
                      <span className="people-avatar" aria-hidden>{member.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                      <div className="min-w-0">
                        <p className="people-person-name">{member.fullName}</p>
                        <p className="people-person-email">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="people-roles-cell">
                    <div className="people-role-chips">
                      {member.roles.length > 0 ? member.roles.map((role) => <span className="people-role-chip" key={role.id}>{role.name}</span>) : <span className="people-no-roles">{t("peopleAccess.users.noRoles")}</span>}
                    </div>
                  </td>
                  <td className="people-status-cell">
                    <Badge className="people-status" variant={member.isActive ? "success" : "secondary"}>
                      <span className="people-status-dot" aria-hidden />
                      {t(member.isActive ? "peopleAccess.status.active" : "peopleAccess.status.inactive")}
                    </Badge>
                  </td>
                  <td className="people-actions-cell">
                    <Can permission="core.users.assign_roles">
                      <Button type="button" variant="outline" size="sm" className="people-card-action" aria-label={t("peopleAccess.users.assign")} onClick={() => { openAssign(member) }}>
                        <KeyRound aria-hidden strokeWidth={1.75} />
                        <span>{t("peopleAccess.users.assign")}</span>
                      </Button>
                    </Can>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {!isLoading && loadError === null ? (
          <PeoplePager page={page} pageSize={DIRECTORY_PAGE_SIZE} total={total}
            summary={t("peopleAccess.pagination.summary", { from, to, total })}
            previousLabel={t("peopleAccess.pagination.previous")} nextLabel={t("peopleAccess.pagination.next")} onPageChange={setPage} />
        ) : null}
      </section>

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
