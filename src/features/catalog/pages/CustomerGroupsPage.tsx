import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { MoreHorizontal, Plus, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { Page } from "@/components/layout/Page"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { EmptyStateProps } from "@/components/ui/empty-state"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { CustomerGroup } from "@/features/catalog/schemas/catalogSchemas"
import {
  deleteCustomerGroup,
  getCatalogProductAccess,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import { cn } from "@/lib/utils"

const WHERE_USED_PRODUCT_CAP = 50

async function loadWhereUsed(): Promise<Record<string, string[]>> {
  const products = await listCatalogProducts()
  const candidates = products.filter((product) => (product.grantedGroupCount ?? 0) > 0).slice(0, WHERE_USED_PRODUCT_CAP)
  const map: Record<string, string[]> = {}
  await Promise.all(candidates.map(async (product) => {
    try {
      const access = await getCatalogProductAccess(product.id)
      for (const groupId of access.groupIds) (map[groupId] ??= []).push(product.name)
    } catch {
      // One product's access must not hide the group list.
    }
  }))
  return map
}

export function CustomerGroupsPage() {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canManage = can("catalog.products.manage")
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [whereUsed, setWhereUsed] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void listCustomerGroups().then((next) => {
      if (cancelled) return
      setGroups(next)
      setLoadError(null)
    }).catch((error: unknown) => {
      if (cancelled) return
      setLoadError(error instanceof Error ? error.message : t("catalog.customerGroups.errors.load"))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    void loadWhereUsed().then((next) => {
      if (!cancelled) setWhereUsed(next)
    }).catch(() => {
      if (!cancelled) setWhereUsed({})
    })
    return () => { cancelled = true }
  }, [t, reloadKey])

  const retry = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    setReloadKey((key) => key + 1)
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(i18n.language)
    if (!term) return groups
    return groups.filter((group) => `${group.name} ${group.description ?? ""}`.toLocaleLowerCase(i18n.language).includes(term))
  }, [groups, i18n.language, search])

  async function remove(group: CustomerGroup) {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteCustomerGroup(group.id)
      setGroups((current) => current.filter((item) => item.id !== group.id))
      setConfirmId(null)
      toast.success(t("catalog.customerGroups.toastDeleted"))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("catalog.customerGroups.errors.delete"))
    } finally {
      setDeleting(false)
    }
  }

  const searching = search.trim() !== ""
  const usedCount = (group: CustomerGroup) => whereUsed[group.id]?.length ?? 0

  function renderName(group: CustomerGroup) {
    return (
      <div className="min-w-0">
        <Link to={`/grupos/${group.id}`} className="text-sm font-medium text-foreground [overflow-wrap:anywhere] hover:underline">{group.name}</Link>
        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{group.description?.trim() || t("grupos.noDescription")}</p>
      </div>
    )
  }

  function renderMembers(group: CustomerGroup) {
    return <Badge variant="outline" className="w-fit whitespace-nowrap">{t("catalog.customerGroups.memberCount", { count: group.memberCustomerIds.length })}</Badge>
  }

  function renderActions(group: CustomerGroup) {
    if (!canManage) return null
    if (confirmId === group.id) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="text-sm">{t("grupos.deleteConfirm")}</p>
          <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => { void remove(group) }}>{t("grupos.delete")}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmId(null)}>{t("common.cancel")}</Button>
        </div>
      )
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t("grupos.rowMenu", { name: group.name })} />}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11 py-2.5" render={<Link to={`/grupos/${group.id}`} />}>{t("grupos.edit")}</DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 py-2.5" variant="destructive" onClick={() => setConfirmId(group.id)}>{t("grupos.delete")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const columns: DataListColumn<CustomerGroup>[] = [
    { id: "name", header: t("grupos.colGroup"), cell: renderName },
    { id: "members", header: t("grupos.colMembers"), cell: renderMembers },
    {
      id: "products",
      header: t("grupos.colProducts"),
      className: "whitespace-nowrap tabular-nums",
      cell: (group) => usedCount(group) > 0 ? usedCount(group) : <span className="text-muted-foreground">{t("grupos.unused")}</span>,
    },
    ...(canManage
      ? [{ id: "actions", header: <span className="sr-only">{t("grupos.colActions")}</span>, align: "end" as const, cell: renderActions }]
      : []),
  ]

  const empty: EmptyStateProps = searching
    ? {
        icon: Users,
        title: t("grupos.noResultsTitle"),
        description: t("grupos.noResults"),
        action: <Button type="button" variant="outline" className="min-h-11" onClick={() => setSearch("")}>{t("grupos.clear")}</Button>,
      }
    : {
        icon: Users,
        title: t("grupos.emptyTitle"),
        description: t("grupos.emptyBody"),
        action: canManage ? <Link to="/grupos/novo" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{t("grupos.emptyAction")}</Link> : undefined,
      }

  const header = {
    title: t("grupos.title"),
    description: t("grupos.subtitle"),
    actions: canManage ? (
      <Link to="/grupos/novo" className={cn(buttonVariants({ variant: "default" }), "min-h-11")}>
        <Plus data-icon="inline-start" aria-hidden="true" />
        {t("grupos.create")}
      </Link>
    ) : undefined,
  }

  if (loadError) return <Page header={header} state="error" error={loadError} onRetry={retry}>{null}</Page>

  return (
    <Page header={header}>
      <DataList<CustomerGroup>
        state={loading ? "loading" : "ready"}
        label={t("grupos.title")}
        loadingLabel={t("common.loading")}
        toolbar={groups.length > 0 ? (
          <FilterBar
            label={t("grupos.search")}
            search={{ value: search, onChange: setSearch, label: t("grupos.search"), placeholder: t("grupos.search") }}
          />
        ) : undefined}
        columns={columns}
        rows={filtered}
        getRowId={(group) => group.id}
        empty={empty}
        renderCard={(group) => (
          <>
            <div className="flex min-w-0 items-start justify-between gap-2">
              {renderName(group)}
              {renderActions(group)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {renderMembers(group)}
              <Badge variant="outline" className="w-fit whitespace-nowrap">{usedCount(group) > 0 ? t("grupos.usedIn", { count: usedCount(group) }) : t("grupos.unused")}</Badge>
            </div>
          </>
        )}
      />
    </Page>
  )
}
