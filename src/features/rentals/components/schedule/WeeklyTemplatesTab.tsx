import { CalendarRange } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import {
  DAY_NAMES,
  formatScheduleTime,
  type AdminRentalAsset,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"

type WeeklyTemplatesTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  rentalAssetId: string
  templates: readonly ScheduleTemplate[]
  loading: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  busyTargetId: string | null
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onRentalAssetChange: (id: string) => void
  onAdd: () => void
  onEdit: (row: ScheduleTemplate) => void
  onToggleActive: (row: ScheduleTemplate) => void
  onDelete: (id: string) => void
  onSeedSelected: () => void
  onSeedTemplates: () => void
  onSavePolicy: (input: UpdateSchedulePolicyInput) => Promise<void>
}

export function WeeklyTemplatesTab({
  assets,
  selectedRentalAssetIds,
  rentalAssetId,
  templates,
  loading,
  busy,
  busyAction,
  busyTargetId,
  readOnly,
  onSelectedRentalAssetIdsChange,
  onRentalAssetChange,
  onAdd,
  onEdit,
  onToggleActive,
  onDelete,
  onSeedSelected,
  onSeedTemplates,
  onSavePolicy,
}: WeeklyTemplatesTabProps) {
  const { t } = useTranslation()

  const selectedAssets = useMemo(
    () =>
      assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )

  const templatesByDay = useMemo(() => {
    const map = new Map<string, ScheduleTemplate[]>()
    for (const dayName of DAY_NAMES) {
      map.set(dayName, [])
    }
    for (const row of templates) {
      const list = map.get(row.dayOfWeek) ?? []
      list.push(row)
      map.set(row.dayOfWeek, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [templates])

  if (assets.length === 0) {
    return (
      <ScheduleEmptyState
        icon={CalendarRange}
        title={t("rentals.schedule.noAssets")}
      />
    )
  }

  return (
    <div className="grid w-full items-start gap-8 lg:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)] lg:gap-10 xl:gap-14">
      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <RentableMultiSelect
            assets={assets}
            selectedIds={selectedRentalAssetIds}
            onChange={onSelectedRentalAssetIdsChange}
          />
        </div>

        {selectedAssets.length > 0 ? (
          <SchedulePolicyPanel
            assets={selectedAssets}
            busy={busy}
            busyAction={busyAction}
            readOnly={readOnly}
            onSave={onSavePolicy}
            onSeedSlotGrid={onSeedSelected}
          />
        ) : null}

        <p className="px-1 text-xs text-muted-foreground">
          {t("rentals.schedule.weeklyConfigHint")}
        </p>
      </aside>

      <section className="min-w-0 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="w-full max-w-sm space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.templatesFineEditRentable")}
            </span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={rentalAssetId}
              onChange={(event) => {
                onRentalAssetChange(event.target.value)
              }}
            >
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              loading={busyAction === "seed"}
              disabled={busy || readOnly || !rentalAssetId}
              onClick={onSeedTemplates}
            >
              {t("rentals.schedule.seedTemplates")}
            </LoadingButton>
            <Button
              type="button"
              size="sm"
              disabled={busy || readOnly || !rentalAssetId}
              onClick={onAdd}
            >
              {t("rentals.schedule.templates.saveCreate")}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {t("rentals.schedule.templatesHint")}
        </p>

        {loading ? (
          <PageContentSkeleton rows={3} />
        ) : templates.length === 0 ? (
          <ScheduleEmptyState
            icon={CalendarRange}
            title={t("rentals.schedule.templatesEmptyTitle")}
            description={t("rentals.schedule.templatesEmptyDescription")}
            actionLabel={t("rentals.schedule.templates.saveCreate")}
            actionDisabled={busy || readOnly || !rentalAssetId}
            onAction={onAdd}
            secondaryAction={
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                loading={busyAction === "seed"}
                disabled={busy || readOnly || !rentalAssetId}
                onClick={onSeedTemplates}
              >
                {t("rentals.schedule.seedTemplates")}
              </LoadingButton>
            }
          />
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {t("rentals.schedule.templatesTitle", { count: templates.length })}
            </p>
            {DAY_NAMES.map((dayName) => {
              const rows = templatesByDay.get(dayName) ?? []
              if (rows.length === 0) {
                return null
              }
              return (
                <div key={dayName} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`rentals.schedule.days.${dayName}`)}
                  </h3>
                  <ul className="space-y-2">
                    {rows.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium tabular-nums">
                            {formatScheduleTime(row.startTime)} –{" "}
                            {formatScheduleTime(row.endTime)}
                            <span className="ml-2 font-normal text-muted-foreground">
                              {row.occupancyKindLabel}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.isActive
                              ? t("rentals.schedule.active")
                              : t("rentals.schedule.inactive")}
                            {row.label ? ` · ${row.label}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || readOnly}
                            onClick={() => {
                              onEdit(row)
                            }}
                          >
                            {t("common.edit")}
                          </Button>
                          <LoadingButton
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={
                              busyAction === "templateToggle" &&
                              busyTargetId === row.id
                            }
                            disabled={busy || readOnly}
                            onClick={() => {
                              onToggleActive(row)
                            }}
                          >
                            {row.isActive
                              ? t("rentals.schedule.deactivate")
                              : t("rentals.schedule.activate")}
                          </LoadingButton>
                          <LoadingButton
                            type="button"
                            size="sm"
                            variant="destructive"
                            loading={
                              busyAction === "templateDelete" &&
                              busyTargetId === row.id
                            }
                            disabled={busy || readOnly}
                            onClick={() => {
                              onDelete(row.id)
                            }}
                          >
                            {t("common.delete")}
                          </LoadingButton>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
