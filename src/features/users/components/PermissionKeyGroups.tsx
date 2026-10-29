import { useTranslation } from "react-i18next"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  groupPermissionsByModule,
  type PermissionCatalogItem,
} from "@/features/users/permissions/permissionGroups"
import { hasPermission } from "@/features/users/permissions/hasPermission"

type PermissionKeyGroupsProps = {
  catalog: readonly PermissionCatalogItem[]
  activeModules: readonly string[]
  selectedKeys: readonly string[]
  disabled?: boolean
  onToggle: (key: string) => void
}

export function PermissionKeyGroups({
  catalog,
  activeModules,
  selectedKeys,
  disabled = false,
  onToggle,
}: PermissionKeyGroupsProps) {
  const { t } = useTranslation()
  const groups = groupPermissionsByModule(catalog, activeModules)

  return (
    <div className="min-w-0 space-y-6">
      {groups.map((group) => {
        const moduleKey = group.moduleKey ?? "core"

        return (
          <section key={moduleKey} className="min-w-0 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">
                {t(`peopleAccess.modules.${moduleKey}`, {
                  defaultValue: moduleKey,
                })}
              </h3>
              {group.moduleInactive ? (
                <p className="text-xs text-muted-foreground">
                  {t("peopleAccess.moduleInactive")}
                </p>
              ) : null}
            </div>

            {group.resources.map((resourceGroup) => (
              <fieldset
                key={`${moduleKey}-${resourceGroup.resource}`}
                className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3"
              >
                <legend className="max-w-full break-words px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`peopleAccess.resources.${resourceGroup.resource}`, {
                    defaultValue: resourceGroup.resource,
                  })}
                </legend>
                <div className="space-y-2">
                  {resourceGroup.items.map((item) => {
                    const inputId = `perm-${item.key}`
                    const checked = hasPermission(selectedKeys, item.key)

                    return (
                      <div
                        key={item.key}
                        className="flex min-w-0 items-start gap-3 py-1"
                      >
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => {
                            onToggle(item.key)
                          }}
                        />
                        <Label
                          htmlFor={inputId}
                          className="min-w-0 cursor-pointer break-words font-normal leading-5 [overflow-wrap:anywhere]"
                        >
                          {t(`peopleAccess.catalog.${item.key}`, {
                            defaultValue: item.name,
                          })}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </section>
        )
      })}
    </div>
  )
}
