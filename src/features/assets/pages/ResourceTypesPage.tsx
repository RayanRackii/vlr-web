import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [showCapabilities, setShowCapabilities] = useState(false)
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
  }, [t])

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

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("assets.resourceTypes.title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("assets.resourceTypes.subtitle")}</p>
        </div>
        {canWrite ? (
          <Link className={buttonVariants()} to="/ativos/tipos/novo">
            <Plus data-icon="inline-start" aria-hidden="true" />
            {t("assets.resourceTypes.new")}
          </Link>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("assets.resourceTypes.search")}
            aria-label={t("assets.resourceTypes.search")}
          />
        </div>
        <Button type="button" variant="outline" onClick={() => setShowCapabilities((current) => !current)}>
          {t("assets.resourceTypes.capability")}
        </Button>
      </div>

      {showCapabilities ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("assets.resourceTypes.capability")}>
          {CAPABILITY_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant={capability === key ? "default" : "outline"}
              onClick={() => setCapability((current) => (current === key ? null : key))}
            >
              {t(`assets.resourceTypes.${key}`)}
            </Button>
          ))}
        </div>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
      {types === null ? <p role="status">{t("common.loading")}</p> : null}

      <ul className="divide-y rounded-lg border">
      {types !== null && error === null && visible.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">{t("assets.resourceTypes.empty")}</li>
        ) : null}
        {visible.map((type) => (
          <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{type.name}</h2>
                <Badge variant={type.seeded ? "secondary" : "outline"}>
                  {type.seeded ? t("assets.resourceTypes.seeded") : t("assets.resourceTypes.company")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{clientLine(type, t)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CAPABILITY_KEYS.filter((key) => type.capabilities[key]).map((key) => (
                  <Badge key={key} variant="outline">{t(`assets.resourceTypes.${key}`)}</Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span>{t("assets.resourceTypes.resources", { count: type.resourceCount })}</span>
              {canWrite ? (
                <Link className={buttonVariants({ variant: "ghost" })} to={`/ativos/tipos/${type.id}`}>
                  {t("assets.resourceTypes.edit")}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
