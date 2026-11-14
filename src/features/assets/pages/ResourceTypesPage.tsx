import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { MoreHorizontal, Plus, Search } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { StatusChips } from "@/components/data-table/StatusChips"
import { Page } from "@/components/layout/Page"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toResourceTypeView, type ResourceTypeView } from "@/features/assets/resourceTypes/resourceTypeModel"
import { listResourceTypes } from "@/features/assets/resourceTypes/resourceTypesService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

const CAPABILITY_KEYS = ["bookable", "deliverable", "maintenance"] as const

function clientLine(type: ResourceTypeView, t: (key: string, options?: Record<string, unknown>) => string) {
  const sees = t("assets.resourceTypes.clientSees", { singular: type.singular })
  if (type.seeded && type.fields.length === 0) {
    return `${sees} · ${t("assets.resourceTypes.ready")}`
  }
  if (type.fields.some((field) => field.visibility === "internal") || type.publicFieldCount !== type.fields.length) {
    return `${sees} · ${t("assets.resourceTypes.fieldsPublic", {
      count: type.fields.length,
      publicCount: type.publicFieldCount,
    })}`
  }
  if (type.fields.length > 0) {
    return `${sees} · ${t("assets.resourceTypes.fields", { count: type.fields.length })}`
  }
  return sees
}

export function ResourceTypesPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canWrite = can("inventory.categories.write")
  const [types, setTypes] = useState<ResourceTypeView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [capability, setCapability] = useState<(typeof CAPABILITY_KEYS)[number] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listResourceTypes()
      .then((records) => {
        if (!controller.signal.aborted) setTypes(records.map(toResourceTypeView))
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t("assets.resourceTypes.errors.load"))
          setTypes([])
        }
      })
    return () => controller.abort()
  }, [t, reloadKey])

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return (types ?? []).filter((type) => {
      const matchesQuery = needle.length === 0
        || type.name.toLocaleLowerCase().includes(needle)
        || type.singular.toLocaleLowerCase().includes(needle)
        || type.plural.toLocaleLowerCase().includes(needle)
      const matchesCapability = capability === null || type.capabilities[capability]
      return matchesQuery && matchesCapability
    })
  }, [capability, query, types])

  function renderType(type: ResourceTypeView) {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <Link to={`/ativos/tipos/${type.id}`} className="text-sm font-medium text-foreground [overflow-wrap:anywhere] hover:underline">{type.name}</Link>
          ) : (
            <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{type.name}</span>
          )}
          <Badge variant={type.seeded ? "secondary" : "outline"}>
            {type.seeded ? t("assets.resourceTypes.seeded") : t("assets.resourceTypes.company")}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{clientLine(type, t)}</p>
      </div>
    )
  }

  function renderCapabilities(type: ResourceTypeView) {
    return (
      <div className="flex flex-wrap gap-2">
        {CAPABILITY_KEYS.filter((key) => type.capabilities[key]).map((key) => (
          <Badge key={key} variant="outline">{t(`assets.resourceTypes.${key}`)}</Badge>
        ))}
      </div>
    )
  }

  function renderResources(type: ResourceTypeView) {
    return t("assets.resourceTypes.resources", { count: type.resourceCount })
  }

  function renderActions(type: ResourceTypeView) {
    if (!canWrite) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t("assets.resourceTypes.rowMenu", { name: type.name })} />}
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11 py-2.5" render={<Link to={`/ativos/tipos/${type.id}`} />}>
            {t("assets.resourceTypes.edit")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const columns: DataListColumn<ResourceTypeView>[] = [
    { id: "type", header: t("assets.resourceTypes.colType"), cell: renderType },
    { id: "capabilities", header: t("assets.resourceTypes.colCapabilities"), cell: renderCapabilities },
    { id: "resources", header: t("assets.resourceTypes.colResources"), className: "whitespace-nowrap tabular-nums", cell: renderResources },
    ...(canWrite
      ? [{ id: "actions", header: <span className="sr-only">{t("assets.resourceTypes.colActions")}</span>, align: "end" as const, cell: renderActions }]
      : []),
  ]

  const header = {
    title: t("assets.resourceTypes.title"),
    description: t("assets.resourceTypes.subtitle"),
    actions: canWrite ? (
      <Link className={buttonVariants()} to="/ativos/tipos/novo">
        <Plus data-icon="inline-start" aria-hidden="true" />
        {t("assets.resourceTypes.new")}
      </Link>
    ) : undefined,
  }

  if (error !== null) {
    return <Page header={header} state="error" error={error} onRetry={() => { setError(null); setTypes(null); setReloadKey((current) => current + 1) }}>{null}</Page>
  }

  return (
    <Page header={header}>
      <DataList<ResourceTypeView>
        state={types === null ? "loading" : "ready"}
        label={t("assets.resourceTypes.title")}
        loadingLabel={t("common.loading")}
        toolbar={(
          <FilterBar
            label={t("assets.resourceTypes.search")}
            search={{ value: query, onChange: setQuery, label: t("assets.resourceTypes.search"), placeholder: t("assets.resourceTypes.search") }}
            filters={(
              <StatusChips
                label={t("assets.resourceTypes.capability")}
                allLabel={t("assets.resourceTypes.all")}
                value={capability}
                onChange={setCapability}
                options={CAPABILITY_KEYS.map((key) => ({ value: key, label: t(`assets.resourceTypes.${key}`) }))}
              />
            )}
          />
        )}
        columns={columns}
        rows={visible}
        getRowId={(type) => type.id}
        empty={{ icon: Search, title: t("assets.resourceTypes.empty") }}
        renderCard={(type) => (
          <>
            <div className="flex min-w-0 items-start justify-between gap-2">
              {renderType(type)}
              {renderActions(type)}
            </div>
            {renderCapabilities(type)}
            <p className="text-sm text-muted-foreground">{renderResources(type)}</p>
          </>
        )}
      />
    </Page>
  )
}
