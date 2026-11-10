import { useContext, useEffect, useState } from "react"
import { Link, UNSAFE_DataRouterContext as DataRouterContext, useBlocker, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { LeaveConfirmDialog } from "@/components/LeaveConfirmDialog"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { createRole } from "@/features/users/services/rolesService"

const ROLES_TAB_PATH = "/pessoas-e-acesso?tab=roles"

function RoleCreateLeaveGuard({ when }: { when: boolean }) {
  const { t } = useTranslation()
  const blocker = useBlocker(when)
  return (
    <LeaveConfirmDialog
      open={blocker.state === "blocked"}
      title={t("fullPage.leaveConfirm")}
      onStay={() => {
        if (blocker.state === "blocked") blocker.reset()
      }}
      onLeave={() => {
        if (blocker.state === "blocked") blocker.proceed()
      }}
    />
  )
}

export function RoleCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const hasDataRouter = useContext(DataRouterContext) != null
  const { refresh } = usePermissions()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const dirty = createdId == null && (name.length > 0 || description.length > 0)

  useEffect(() => {
    if (!dirty) return
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", preventUnload)
    return () => window.removeEventListener("beforeunload", preventUnload)
  }, [dirty])

  useEffect(() => {
    if (!createdId) return
    void navigate(`/pessoas-e-acesso/funcoes/${createdId}?tab=permissions`)
  }, [createdId, navigate])

  async function submit() {
    if (name.trim().length < 2 || saving) return
    setSaving(true)
    try {
      const created = await createRole({
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        permissionKeys: [],
      })
      toast.success(t("peopleAccess.toasts.roleCreated"))
      await refresh()
      setCreatedId(created.id)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("peopleAccess.errors.createRole"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl space-y-6 pb-8">
      {hasDataRouter ? <RoleCreateLeaveGuard when={createdId == null && (dirty || saving)} /> : null}
      <Link
        className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
        to={ROLES_TAB_PATH}
      >
        {t("peopleAccess.tabs.roles")}
      </Link>
      <PageHeader
        title={t("peopleAccess.roles.createTitle")}
        description={t("peopleAccess.roles.editorDescription")}
      />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="new-role-name">{t("peopleAccess.role")}</Label>
          <Input
            id="new-role-name"
            value={name}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-role-description">{t("peopleAccess.roles.descriptionLabel")}</Label>
          <Textarea
            id="new-role-description"
            value={description}
            disabled={saving}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => navigate(ROLES_TAB_PATH)}>
            {t("common.cancel")}
          </Button>
          <LoadingButton
            type="submit"
            loading={saving}
            disabled={name.trim().length < 2}
          >
            {t("peopleAccess.roleEditor.createContinue")}
          </LoadingButton>
        </div>
      </form>
    </div>
  )
}
