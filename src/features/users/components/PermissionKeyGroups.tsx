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
    <div className="space-y-6">
      {groups.map((group) => {
        const moduleKey = group.moduleKey ?? "core"

        return (
          <section key={moduleKey} className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">
                {t(`peopleAccess.modules.${moduleKey}`, {
                  defaultValue: moduleKey,
                })}
              </h3>
              {group.moduleInactive ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {t("peopleAccess.moduleInactive")}
                </p>
              ) : null}
            </div>

            {group.resources.map((resourceGroup) => (
              <fieldset
                key={`${moduleKey}-${resourceGroup.resource}`}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                        className="flex items-start gap-2"
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
                          className="cursor-pointer font-normal leading-5"
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
