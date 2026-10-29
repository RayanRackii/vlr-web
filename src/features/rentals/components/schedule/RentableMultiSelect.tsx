import { Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

type RentableMultiSelectProps = {
  assets: readonly AdminRentalAsset[]
  selectedIds: readonly string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function RentableMultiSelect({
  assets,
  selectedIds,
  onChange,
  disabled = false,
}: RentableMultiSelectProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const selectedSet = new Set(selectedIds)
  const allSelected = assets.length > 0 && selectedIds.length === assets.length
  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) {
      return assets
    }
    return assets.filter((asset) =>
      asset.name.toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [assets, query])

  return (
    <fieldset className="min-w-0 space-y-3" disabled={disabled}>
      <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">
          {t("rentals.schedule.rentables")}
          <span className="ml-1 font-normal text-muted-foreground">
            (
            {t("rentals.schedule.selectedCount", {
              selected: selectedIds.length,
              total: assets.length,
            })}
            )
          </span>
        </span>
        <span className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled || allSelected}
            onClick={() => {
              onChange(assets.map((asset) => asset.id))
            }}
          >
            {t("rentals.schedule.selectAll")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled || selectedIds.length === 0}
            onClick={() => {
              onChange([])
            }}
          >
            {t("rentals.schedule.clearSelection")}
          </Button>
        </span>
      </legend>

      <label className="relative block">
        <span className="sr-only">{t("rentals.schedule.filterRentables")}</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          className="pl-9"
          placeholder={t("rentals.schedule.filterRentables")}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value)
          }}
        />
      </label>

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2">
        {filteredAssets.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("rentals.schedule.noMatchingRentables")}
          </p>
        ) : (
          filteredAssets.map((asset) => {
            const checked = selectedSet.has(asset.id)
            return (
              <label
                key={asset.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    if (checked) {
                      onChange(selectedIds.filter((id) => id !== asset.id))
                      return
                    }
                    onChange([...selectedIds, asset.id])
                  }}
                />
                <span className="min-w-0 truncate">{asset.name}</span>
              </label>
            )
          })
        )}
      </div>
    </fieldset>
  )
}
