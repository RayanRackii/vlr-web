import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react"
import {
  CalendarDays,
  ClipboardList,
  Minus,
  Package,
  Plus,
  Settings2,
  ShoppingCart,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  groupPermissionsByModule,
  type PermissionCatalogItem,
} from "@/features/users/permissions/permissionGroups"
import { hasPermission } from "@/features/users/permissions/hasPermission"

const MODULE_ICONS: Record<string, LucideIcon> = {
  core: Settings2,
  inventory: Package,
  pmoc: ClipboardList,
  os: Wrench,
  rentals: CalendarDays,
  catalog: ShoppingCart,
}

type RolePermissionsEditorProps = {
  catalog: readonly PermissionCatalogItem[]
  activeModules: readonly string[]
  selectedKeys: readonly string[]
  disabled?: boolean
  onChange: (next: string[]) => void
}

/** Native checkbox that reflects an indeterminate state via a ref. */
function TriStateCheckbox({
  checked,
  indeterminate,
  className,
  ...props
}: ComponentProps<"input"> & { indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate) && !checked
    }
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      data-slot="checkbox"
      checked={checked}
      className={cn(
        "touch-target size-4 shrink-0 cursor-pointer rounded border border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export function RolePermissionsEditor({
  catalog,
  activeModules,
  selectedKeys,
  disabled = false,
  onChange,
}: RolePermissionsEditorProps) {
  const { t } = useTranslation()
  const groups = useMemo(
    () => groupPermissionsByModule(catalog, activeModules),
    [catalog, activeModules],
  )

  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const query = search.trim().toLowerCase()

  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys])

  function labelFor(item: PermissionCatalogItem) {
    return t(`peopleAccess.catalog.${item.key}`, { defaultValue: item.name })
  }

  function itemMatches(item: PermissionCatalogItem) {
    if (!query) return true
    return (
      item.key.toLowerCase().includes(query) ||
      labelFor(item).toLowerCase().includes(query)
    )
  }

  function toggleKey(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange([...next])
  }

  function setModule(keys: string[], value: boolean) {
    const next = new Set(selected)
    for (const key of keys) {
      if (value) next.add(key)
      else next.delete(key)
    }
    onChange([...next])
  }

  const allModuleKeys = groups.map((group) => group.moduleKey ?? "core")

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("peopleAccess.roleEditor.searchPlaceholder")}
          aria-label={t("peopleAccess.roleEditor.searchPlaceholder")}
          className="h-9 max-w-xs"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(new Set(allModuleKeys))}
          >
            {t("peopleAccess.roleEditor.expandAll")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(new Set())}
          >
            {t("peopleAccess.roleEditor.collapseAll")}
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {groups.map((group) => {
          const moduleKey = group.moduleKey ?? "core"
          const Icon = MODULE_ICONS[moduleKey] ?? Settings2
          const moduleItems = group.resources.flatMap((r) => r.items)
          const moduleKeys = moduleItems.filter(itemMatches).map((item) => item.key)
          const selectedCount = moduleKeys.filter((key) =>
            hasPermission(selectedKeys, key),
          ).length
          const total = moduleKeys.length
          const allSelected = total > 0 && selectedCount === total
          const someSelected = selectedCount > 0 && selectedCount < total

          const hasMatch = moduleItems.some(itemMatches)
          if (query && !hasMatch) return null

          const open = query ? hasMatch : expanded.has(moduleKey)

          return (
            <section
              key={moduleKey}
              className="min-w-0 self-start rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3 p-3">
                <Icon
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">
                    {t(`peopleAccess.modules.${moduleKey}`, {
                      defaultValue: moduleKey,
                    })}
                  </h3>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {t("peopleAccess.roleEditor.moduleCount", {
                      selected: selectedCount,
                      total,
                    })}
                  </p>
                </div>
                <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-muted-foreground">
                  <TriStateCheckbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    aria-label={`${t("peopleAccess.roleEditor.selectAllModule")}: ${t(`peopleAccess.modules.${moduleKey}`, { defaultValue: moduleKey })}`}
                    disabled={disabled || total === 0}
                    onChange={() => setModule(moduleKeys, !allSelected)}
                  />
                  <span className="hidden sm:inline">
                    {t("peopleAccess.roleEditor.selectAllModule")}
                  </span>
                </Label>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={
                    open
                      ? t("peopleAccess.roleEditor.collapseAll")
                      : t("peopleAccess.roleEditor.expandAll")
                  }
                  disabled={Boolean(query)}
                  onClick={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(moduleKey)) next.delete(moduleKey)
                      else next.add(moduleKey)
                      return next
                    })
                  }}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-input text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {open ? (
                    <Minus className="size-4" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                </button>
              </div>

              {group.moduleInactive && open ? (
                <p className="px-3 pb-2 text-xs text-muted-foreground">
                  {t("peopleAccess.moduleInactive")}
                </p>
              ) : null}

              {open ? (
                <div className="space-y-3 border-t border-border p-3">
                  {group.resources.map((resourceGroup) => {
                    const items = resourceGroup.items.filter(itemMatches)
                    if (items.length === 0) return null
                    return (
                      <fieldset
                        key={`${moduleKey}-${resourceGroup.resource}`}
                        className="min-w-0 space-y-2"
                      >
                        <legend className="max-w-full break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t(
                            `peopleAccess.resources.${resourceGroup.resource}`,
                            { defaultValue: resourceGroup.resource },
                          )}
                        </legend>
                        {items.map((item) => {
                          const inputId = `perm-${item.key}`
                          return (
                            <div
                              key={item.key}
                              className="flex min-w-0 items-start gap-3 py-1"
                            >
                              <Checkbox
                                id={inputId}
                                checked={hasPermission(selectedKeys, item.key)}
                                disabled={disabled}
                                onChange={() => toggleKey(item.key)}
                              />
                              <Label
                                htmlFor={inputId}
                                className="min-w-0 cursor-pointer break-words font-normal leading-5 [overflow-wrap:anywhere]"
                              >
                                {labelFor(item)}
                              </Label>
                            </div>
                          )
                        })}
                      </fieldset>
                    )
                  })}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      {query && !groups.some((group) => group.resources.flatMap((r) => r.items).some(itemMatches)) ? (
        <p className="text-sm text-muted-foreground">
          {t("peopleAccess.roleEditor.noResults")}
        </p>
      ) : null}
    </div>
  )
}
