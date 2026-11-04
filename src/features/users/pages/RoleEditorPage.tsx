import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EntityPage, type EntityTab } from "@/components/layout/EntityPage"
import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RolePermissionsEditor } from "@/features/users/components/RolePermissionsEditor"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { getRoleEditorPolicy } from "@/features/users/permissions/rolePolicy"
import type {
  PermissionCatalogItemDto,
  RoleResponse,
} from "@/features/users/schemas/roleSchemas"
import {
  getRole,
  listPermissions,
  patchRole,
  replaceRolePermissions,
} from "@/features/users/services/rolesService"
import { listTenantMembers } from "@/features/users/services/usersService"
import type { TenantMember } from "@/features/users/schemas/userSchemas"

const ROLES_TAB_PATH = "/pessoas-e-acesso?tab=roles"

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return right.every((key) => set.has(key))
}

export function RoleEditorPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { can, activeModules, refresh } = usePermissions()
  const canManage = can("core.roles.manage")

  const [role, setRole] = useState<RoleResponse | null>(null)
  const [catalog, setCatalog] = useState<PermissionCatalogItemDto[]>([])
  const [members, setMembers] = useState<TenantMember[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [permissionKeys, setPermissionKeys] = useState<string[]>([])
  const [tab, setTab] = useState<string>(searchParams.get("tab") ?? "dados")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || id === "nova") {
      void navigate(ROLES_TAB_PATH, { replace: true })
      return
    }

    let active = true

    Promise.all([getRole(id), listPermissions()])
      .then(([nextRole, nextCatalog]) => {
        if (!active) return
        setRole(nextRole)
        setCatalog(nextCatalog)
        setName(nextRole.name)
        setDescription(nextRole.description ?? "")
        setPermissionKeys([...nextRole.permissionKeys])
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(
          error instanceof Error ? error.message : t("peopleAccess.errors.loadRole"),
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    listTenantMembers({ pageSize: 100 })
      .then((page) => active && setMembers(page.items))
      .catch(() => active && setMembers([]))

    return () => {
      active = false
    }
  }, [id, navigate, t])

  const policy = role
    ? getRoleEditorPolicy(role)
    : {
        canRename: false,
        canEditPermissions: false,
        isFullyReadonly: true,
        kind: "custom" as const,
      }
  const canWrite = canManage && !policy.isFullyReadonly
  const nameLocked = !policy.canRename || !canWrite
  const permissionsLocked = !canWrite || !policy.canEditPermissions

  const roleMembers = useMemo(
    () => (members ?? []).filter((m) => m.roles.some((r) => r.id === role?.id)),
    [members, role?.id],
  )

  const nameChanged = role ? name.trim() !== role.name : false
  const descChanged = role ? (description ?? "").trim() !== (role.description ?? "").trim() : false
  const permsChanged = role ? !sameKeys(permissionKeys, role.permissionKeys) : false
  const dirty = canWrite && (nameChanged || descChanged || permsChanged)
  const unsavedCount =
    (nameChanged ? 1 : 0) + (descChanged ? 1 : 0) + (permsChanged ? 1 : 0)

  function handleDiscard() {
    if (!role) return
    setName(role.name)
    setDescription(role.description ?? "")
    setPermissionKeys([...role.permissionKeys])
  }

  async function handleSave() {
    if (!role || !canWrite || name.trim().length < 2) return
    setSaving(true)
    try {
      let updated: RoleResponse
      if (policy.kind === "custom") {
        updated = await patchRole(role.id, {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          permissionKeys,
        })
      } else {
        updated = await replaceRolePermissions(role.id, permissionKeys)
      }
      setRole(updated)
      setName(updated.name)
      setDescription(updated.description ?? "")
      setPermissionKeys([...updated.permissionKeys])
      toast.success(t("peopleAccess.toasts.roleUpdated"))
      await refresh()
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : t("peopleAccess.errors.updateRole"),
      )
    } finally {
      setSaving(false)
    }
  }

  if (!canManage && !can("core.roles.read")) {
    return <AccessDeniedPage />
  }

  if (isLoading) {
    return <PageContentSkeleton rows={4} />
  }

  if (loadError || !role) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {loadError ?? t("peopleAccess.roleEditor.notFound")}
          </AlertDescription>
        </Alert>
        <Link to={ROLES_TAB_PATH} className="text-sm font-medium text-primary hover:underline">
          {t("peopleAccess.roleEditor.backToRoles")}
        </Link>
      </div>
    )
  }

  const selectedCount = permissionKeys.filter((key) =>
    catalog.some((item) => item.key === key),
  ).length

  const dadosTab: EntityTab = {
    value: "dados",
    label: t("peopleAccess.roleEditor.tabs.dados"),
    content: (
      <div className="max-w-xl space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role-name">{t("peopleAccess.role")}</Label>
          <Input
            id="role-name"
            value={name}
            disabled={nameLocked}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-description">
            {t("peopleAccess.roles.descriptionLabel")}
          </Label>
          <Textarea
            id="role-description"
            value={description}
            disabled={nameLocked}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
      </div>
    ),
  }

  const permissionsTab: EntityTab = {
    value: "permissions",
    label: t("peopleAccess.permissions"),
    badge: t("peopleAccess.roleEditor.moduleCount", {
      selected: selectedCount,
      total: catalog.length,
    }),
    content: (
      <RolePermissionsEditor
        catalog={catalog}
        activeModules={activeModules}
        selectedKeys={permissionKeys}
        disabled={permissionsLocked}
        onChange={setPermissionKeys}
      />
    ),
  }

  const membersTab: EntityTab = {
    value: "members",
    label: t("peopleAccess.roleEditor.tabs.members"),
    badge: roleMembers.length,
    content:
      roleMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("peopleAccess.roleEditor.membersEmpty")}
        </p>
      ) : (
        <ul className="max-w-xl divide-y divide-border rounded-lg border border-border">
          {roleMembers.map((member) => (
            <li key={member.id} className="flex flex-col gap-0.5 p-3">
              <span className="break-words text-sm font-medium">{member.fullName}</span>
              <span className="text-xs text-muted-foreground">{member.email}</span>
            </li>
          ))}
        </ul>
      ),
  }

  const tabs: EntityTab[] = [dadosTab, permissionsTab]
  if (members !== null) tabs.push(membersTab)

  return (
    <EntityPage
      breadcrumb={
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="breadcrumb">
          <Link to="/pessoas-e-acesso" className="hover:text-foreground">
            {t("peopleAccess.title")}
          </Link>
          <span aria-hidden>›</span>
          <Link to={ROLES_TAB_PATH} className="hover:text-foreground">
            {t("peopleAccess.roleEditor.breadcrumb")}
          </Link>
          <span aria-hidden>›</span>
          <span className="text-foreground">{role.name}</span>
        </nav>
      }
      title={role.name}
      badges={
        <Badge variant={role.isSystemRole ? "secondary" : "outline"}>
          {role.isSystemRole
            ? t("peopleAccess.badges.system")
            : t("peopleAccess.badges.custom")}
        </Badge>
      }
      tabs={tabs}
      value={tab}
      onValueChange={setTab}
      dirty={dirty}
      unsavedCount={unsavedCount}
      onSave={canWrite ? handleSave : undefined}
      onDiscard={canWrite ? handleDiscard : undefined}
      saving={saving}
      saveLabel={t("peopleAccess.roles.save")}
    />
  )
}
