import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  inviteTenantUser,
  listTenantUsers,
  promoteTenantUser,
  resendTenantInvite,
  revokeTenantInvite,
  type TenantInvite,
  type TenantUser,
} from "@/features/admin/services/tenantUsersService"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type TenantUsersManagerProps = {
  tenantId: string
}

export function TenantUsersManager({ tenantId }: TenantUsersManagerProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<TenantUser[]>([])
  const [invites, setInvites] = useState<TenantInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const bundle = await listTenantUsers(tenantId)
      setUsers(bundle.users)
      setInvites(bundle.invites)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("admin.users.loadError"),
      )
    } finally {
      setLoading(false)
    }
  }, [tenantId, t])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleInvite() {
    setBusy(true)
    try {
      await inviteTenantUser(tenantId, { fullName, email, roleName: "Admin" })
      setFullName("")
      setEmail("")
      toast.success(t("admin.users.inviteSent"))
      await reload()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("admin.users.inviteError"),
      )
    } finally {
      setBusy(false)
    }
  }

  const pendingInvites = invites.filter((invite) => invite.isPending)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t("admin.users.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("admin.users.description")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="invite-name">{t("admin.users.fullName")}</Label>
          <Input
            id="invite-name"
            value={fullName}
            disabled={busy}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">{t("admin.users.email")}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <LoadingButton
          type="button"
          loading={busy}
          disabled={fullName.trim().length < 2 || !email.includes("@")}
          onClick={() => {
            void handleInvite()
          }}
        >
          {t("admin.users.inviteAdmin")}
        </LoadingButton>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("admin.users.activeUsers")}
            </p>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.users.noUsers")}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {users.map((user) => {
                  const isAdmin = user.roles.some((role) =>
                    /admin/i.test(role),
                  )
                  return (
                    <li
                      key={user.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.fullName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))}
                        {!isAdmin ? (
                          <LoadingButton
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={busy}
                            onClick={() => {
                              void (async () => {
                                setBusy(true)
                                try {
                                  await promoteTenantUser(
                                    tenantId,
                                    user.id,
                                    "Admin",
                                  )
                                  toast.success(t("admin.users.promoted"))
                                  await reload()
                                } catch (error: unknown) {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : t("admin.users.promoteError"),
                                  )
                                } finally {
                                  setBusy(false)
                                }
                              })()
                            }}
                          >
                            {t("admin.users.makeAdmin")}
                          </LoadingButton>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("admin.users.pendingInvites")}
            </p>
            {pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.users.noInvites")}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {invite.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invite.email} · {invite.roleName}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <LoadingButton
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={busy}
                        onClick={() => {
                          void (async () => {
                            setBusy(true)
                            try {
                              await resendTenantInvite(tenantId, invite.id)
                              toast.success(t("admin.users.resent"))
                              await reload()
                            } catch (error: unknown) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : t("admin.users.resendError"),
                              )
                            } finally {
                              setBusy(false)
                            }
                          })()
                        }}
                      >
                        {t("admin.users.resend")}
                      </LoadingButton>
                      <LoadingButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        loading={busy}
                        onClick={() => {
                          void (async () => {
                            setBusy(true)
                            try {
                              await revokeTenantInvite(tenantId, invite.id)
                              toast.success(t("admin.users.revoked"))
                              await reload()
                            } catch (error: unknown) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : t("admin.users.revokeError"),
                              )
                            } finally {
                              setBusy(false)
                            }
                          })()
                        }}
                      >
                        {t("admin.users.revoke")}
                      </LoadingButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
