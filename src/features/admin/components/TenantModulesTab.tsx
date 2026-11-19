import { Check, Layers, Package, Tent, Zap, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { UseFormReturn } from "react-hook-form"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FormField, FormItem, FormMessage } from "@/components/ui/form"
import { CommercialModulePicker } from "@/features/admin/components/CommercialModulePicker"
import type { AdminModuleCatalogItem } from "@/features/admin/schemas/adminModuleCatalogSchemas"
import type { TenantEditFormValues } from "@/features/admin/schemas/adminTenantSchemas"
import type { AssetFamily } from "@/features/assets/schemas/assetFamilySchemas"
import { cn } from "@/lib/utils"

const FAMILY_ICONS: Record<string, LucideIcon> = {
  spaces: Tent,
  electrical: Zap,
  goods: Package,
  generic: Layers,
}

function familyIcon(key: string): LucideIcon {
  return FAMILY_ICONS[key] ?? Layers
}

type TenantModulesTabProps = {
  form: UseFormReturn<TenantEditFormValues>
  disabled: boolean
  hasLegacyMaintenance: boolean
  commercialModules: readonly AdminModuleCatalogItem[]
  modulesLoading: boolean
  modulesError: string | null
  onRetryModules: () => void
  families: readonly AssetFamily[]
  onToggleModule: (moduleKey: string) => void
  onToggleFamily: (familyKey: string) => void
}

/** "Módulos e famílias" tab: commercial modules and resource families. */
export function TenantModulesTab({
  form,
  disabled,
  hasLegacyMaintenance,
  commercialModules,
  modulesLoading,
  modulesError,
  onRetryModules,
  families,
  onToggleModule,
  onToggleFamily,
}: TenantModulesTabProps) {
  const { t, i18n } = useTranslation()
  const activeModules = form.watch("activeModules")
  const assetFamilyKeys = form.watch("assetFamilyKeys")

  return (
    <div className="space-y-6">
      <Card id="tenant-modules">
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.sections.modules")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.sections.modulesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasLegacyMaintenance ? (
            <p className="text-sm text-muted-foreground" role="note">
              {t("admin.modules.legacyMaintenanceNote")}
            </p>
          ) : null}
          <FormField
            control={form.control}
            name="activeModules"
            render={() => (
              <FormItem>
                <CommercialModulePicker
                  modules={commercialModules}
                  selectedKeys={activeModules}
                  isLoading={modulesLoading}
                  error={modulesError}
                  onRetry={onRetryModules}
                  onToggle={onToggleModule}
                  disabled={disabled}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {t("admin.edit.sections.families")}
          </CardTitle>
          <CardDescription>
            {t("admin.edit.sections.familiesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="assetFamilyKeys"
            render={() => (
              <FormItem>
                <div className="grid gap-3 sm:grid-cols-2">
                  {families.map((family) => {
                    const selected = assetFamilyKeys.includes(family.key)
                    const Icon = familyIcon(family.key)
                    const descriptionKey = `admin.wizard.families.descriptions.${family.key}`
                    const description = i18n.exists(descriptionKey)
                      ? t(descriptionKey)
                      : null

                    return (
                      <button
                        key={family.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() => {
                          onToggleFamily(family.key)
                        }}
                        className={cn(
                          "relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/40",
                          disabled && "pointer-events-none opacity-60",
                        )}
                      >
                        {selected ? (
                          <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                            <Check className="size-4" />
                          </span>
                        ) : null}
                        <Icon className="size-5 text-foreground" />
                        <span className="text-sm font-medium">{family.label}</span>
                        {description ? (
                          <span className="text-xs text-muted-foreground">
                            {description}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  )
}
