import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
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
  const selectedSet = new Set(selectedIds)
  const allSelected = assets.length > 0 && selectedIds.length === assets.length

  return (
    <fieldset className="min-w-0 flex-1 space-y-2" disabled={disabled}>
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
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2">
        {assets.map((asset) => {
          const checked = selectedSet.has(asset.id)
          return (
            <label
              key={asset.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
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
        })}
      </div>
    </fieldset>
  )
}
