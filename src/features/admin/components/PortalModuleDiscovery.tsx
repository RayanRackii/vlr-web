import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import {
  areAllCatalogModulesActive,
  isModuleCatalogEntryActive,
  modulesByCategory,
  type ModuleCatalogEntry,
} from "@/features/admin/moduleCatalog"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

function ModuleCard({
  entry,
  active,
}: {
  entry: ModuleCatalogEntry
  active: boolean
}) {
  const { t } = useTranslation()
  const Icon = entry.icon

  return (
    <li className="rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm font-medium leading-5">
          {t(entry.nameKey)}
        </p>
        <Badge variant={active ? "success" : "outline"}>
          {active
            ? t("admin.moduleMenu.stateActive")
            : t("admin.moduleMenu.stateAvailable")}
        </Badge>
      </div>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        {t(entry.descriptionKey)}
      </p>
    </li>
  )
}

function CategorySection({
  title,
  entries,
  activeModules,
}: {
  title: string
  entries: readonly ModuleCatalogEntry[]
  activeModules: readonly string[]
}) {
  if (entries.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <ModuleCard
            key={entry.key}
            entry={entry}
            active={isModuleCatalogEntryActive(entry.key, activeModules)}
          />
        ))}
      </ul>
    </section>
  )
}

export function PortalModuleDiscovery() {
  const { t } = useTranslation()
  const { activeModules } = usePermissions()
  const allActive = areAllCatalogModulesActive(activeModules)
  const customerModules = modulesByCategory("customer")
  const operationsModules = modulesByCategory("operations")

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          {t("admin.moduleMenu.exploreTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("admin.moduleMenu.exploreDescription")}
        </p>
        {allActive ? (
          <p className="pt-1 text-sm text-muted-foreground">
            {t("admin.moduleMenu.exploreAllActive")}
          </p>
        ) : null}
      </div>

      <CategorySection
        title={t("admin.moduleMenu.categoryCustomer")}
        entries={customerModules}
        activeModules={activeModules}
      />
      <CategorySection
        title={t("admin.moduleMenu.categoryOperations")}
        entries={operationsModules}
        activeModules={activeModules}
      />
    </div>
  )
}
