import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import type { CustomerGroup } from "@/features/catalog/schemas/catalogSchemas"
import {
  deleteCustomerGroup,
  getCatalogProductAccess,
  listCatalogProducts,
  listCustomerGroups,
} from "@/features/catalog/services/catalogService"
import "@/features/catalog/pages/grupos.css"
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
  }, [t])

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

  const createLink = canManage ? (
    <Link to="/grupos/novo" className={cn(buttonVariants({ variant: "default" }), "grupos-primary min-h-11")}>{t("grupos.create")}</Link>
  ) : null

  return (
    <div className="grupos-page mx-auto min-w-0 space-y-5">
      <header className="grupos-header">
        <div className="min-w-0">
          <p className="grupos-eyebrow">{t("grupos.eyebrow")}</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("grupos.title")}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("grupos.subtitle")}</p>
        </div>
        {createLink}
      </header>
      {loadError ? <p role="alert" className="text-sm text-destructive">{loadError}</p> : null}
      <section className="grupos-card" aria-label={t("grupos.title")} aria-busy={loading}>
        {loading ? <p role="status" className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p> : null}
        {!loading && !loadError && groups.length === 0 ? (
          <div className="grupos-empty" role="status">
            <h2 className="text-base font-semibold">{t("grupos.emptyTitle")}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("grupos.emptyBody")}</p>
            {canManage ? <Link to="/grupos/novo" className={cn(buttonVariants({ variant: "outline" }), "mt-4 min-h-11")}>{t("grupos.emptyAction")}</Link> : null}
          </div>
        ) : null}
        {!loading && !loadError && groups.length > 0 ? (
          <>
            <div className="grupos-toolbar">
              <label className="grupos-search">
                <Search aria-hidden />
                <Input type="search" aria-label={t("grupos.search")} placeholder={t("grupos.search")} value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
            </div>
            {filtered.length === 0 ? (
              <div className="grupos-empty" role="status">
                <h2 className="text-base font-semibold">{t("grupos.noResultsTitle")}</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("grupos.noResults")}</p>
                <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => setSearch("")}>{t("grupos.clear")}</Button>
              </div>
            ) : filtered.map((group) => {
              const used = whereUsed[group.id]?.length ?? 0
              const description = group.description?.trim() || t("grupos.noDescription")
              const usage = used > 0 ? t("grupos.usedIn", { count: used }) : t("grupos.unused")
              return (
                <article key={group.id} className="grupos-row">
                  <div className="grupos-row-main">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{group.name}</p>
                      <span className="grupos-badge">{t("catalog.customerGroups.memberCount", { count: group.memberCustomerIds.length })}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{description} · {usage}</p>
                  </div>
                  {canManage ? (
                    <div className="grupos-actions">
                      {confirmId === group.id ? (
                        <>
                          <p className="self-center text-sm">{t("grupos.deleteConfirm")}</p>
                          <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => { void remove(group) }}>{t("grupos.delete")}</Button>
                          <Button type="button" variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmId(null)}>{t("common.cancel")}</Button>
                        </>
                      ) : (
                        <>
                          <Link to={`/grupos/${group.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>{t("grupos.edit")}</Link>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmId(group.id)}>{t("grupos.delete")}</Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </>
        ) : null}
      </section>
    </div>
  )
}
