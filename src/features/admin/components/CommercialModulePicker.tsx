import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { presentCommercialModule } from "@/features/admin/moduleCatalog"
import type { AdminModuleCatalogItem } from "@/features/admin/schemas/adminModuleCatalogSchemas"
import { toCanonicalModuleName } from "@/features/catalog/customerNav"
import { cn } from "@/lib/utils"

type CommercialModulePickerProps = {
  modules: readonly AdminModuleCatalogItem[]
  selectedKeys: readonly string[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onToggle: (moduleKey: string) => void
  disabled?: boolean
}

export function CommercialModulePicker({
  modules,
  selectedKeys,
  isLoading,
  error,
  onRetry,
  onToggle,
  disabled = false,
}: CommercialModulePickerProps) {
  const { t, i18n } = useTranslation()

  if (isLoading) {
    return (
      <div
        className="grid gap-3 sm:grid-cols-2"
        data-slot="skeleton"
        aria-busy="true"
      >
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t("admin.modules.retry")}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((item) => {
          const presented = presentCommercialModule(item.key)
          const Icon = presented.icon
          const selected = selectedKeys.some(
            (key) => toCanonicalModuleName(key) === presented.key,
          )
          const name = i18n.exists(presented.nameKey)
            ? t(presented.nameKey)
            : presented.key
          const description = i18n.exists(presented.descriptionKey)
            ? t(presented.descriptionKey)
            : null

          return (
            <button
              key={presented.key}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => {
                onToggle(presented.key)
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
                  <Check className="size-3" />
                </span>
              ) : null}
              <Icon className="size-5 text-foreground" />
              <span className="text-sm font-medium">{name}</span>
              {description ? (
                <span className="text-xs text-muted-foreground">
                  {description}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
