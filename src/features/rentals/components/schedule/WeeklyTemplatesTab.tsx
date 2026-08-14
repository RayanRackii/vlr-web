import { CalendarRange } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import {
  DAY_NAMES,
  formatScheduleTime,
  type AdminRentalAsset,
  type OccupancyKind,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"

export type WeeklyRuleDraft = {
  rentalAssetIds: readonly string[]
  daysOfWeek: readonly string[]
  openTime: string
  closeTime: string
  slotMinutes: number
  occupancyKindId: string
}

type WeeklyTemplatesTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  rentalAssetId: string
  templates: readonly ScheduleTemplate[]
  kinds: readonly OccupancyKind[]
  defaultKindId: string
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
  onApplyWeeklyRule: (draft: WeeklyRuleDraft) => Promise<boolean>
}

export function WeeklyTemplatesTab({
  assets,
  selectedRentalAssetIds,
  rentalAssetId,
  templates,
  kinds,
  defaultKindId,
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
  onApplyWeeklyRule,
}: WeeklyTemplatesTabProps) {
  const { t } = useTranslation()

  const selectedAssets = useMemo(
    () =>
      assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )
  const [days, setDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ])
  const [openTime, setOpenTime] = useState("08:00")
  const [closeTime, setCloseTime] = useState("22:00")
  const [slotMinutes, setSlotMinutes] = useState(60)
  const [occupancyKindId, setOccupancyKindId] = useState(defaultKindId)
  const ruleKindId = occupancyKindId || defaultKindId

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

        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold">
              {t("rentals.schedule.weeklyRule.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("rentals.schedule.weeklyConfigHint")}
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {t("rentals.schedule.weeklyRule.days")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {DAY_NAMES.map((dayName) => {
                const checked = days.includes(dayName)
                return (
                  <label key={dayName} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={checked}
                      disabled={busy || readOnly}
                      onChange={() =>
                        setDays((current) =>
                          checked
                            ? current.filter((day) => day !== dayName)
                            : [...current, dayName],
                        )
                      }
                    />
                    {t(`rentals.schedule.days.${dayName}`)}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span>{t("rentals.schedule.policy.openTime")}</span>
              <Input
                type="time"
                value={openTime}
                disabled={busy || readOnly}
                onChange={(event) => setOpenTime(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("rentals.schedule.policy.closeTime")}</span>
              <Input
                type="time"
                value={closeTime}
                disabled={busy || readOnly}
                onChange={(event) => setCloseTime(event.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1 text-xs">
            <span>{t("rentals.schedule.policy.slotMinutes")}</span>
            <Input
              type="number"
              min={15}
              step={15}
              value={slotMinutes}
              disabled={busy || readOnly}
              onChange={(event) => setSlotMinutes(Number(event.target.value))}
            />
          </label>
          <label className="block space-y-1 text-xs">
            <span>{t("rentals.schedule.templates.kind")}</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={ruleKindId}
              disabled={busy || readOnly}
              onChange={(event) => setOccupancyKindId(event.target.value)}
            >
              {kinds.filter((kind) => kind.isActive).map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <LoadingButton
            type="button"
            className="w-full"
            loading={busyAction === "weeklyRule"}
            disabled={
              busy ||
              readOnly ||
              selectedRentalAssetIds.length === 0 ||
              days.length === 0 ||
              !ruleKindId ||
              !openTime ||
              !closeTime ||
              slotMinutes < 1
            }
            onClick={() => {
              void onApplyWeeklyRule({
                rentalAssetIds: selectedRentalAssetIds,
                daysOfWeek: days,
                openTime,
                closeTime,
                slotMinutes,
                occupancyKindId: ruleKindId,
              })
            }}
          >
            {t("rentals.schedule.weeklyRule.apply")}
          </LoadingButton>
        </div>
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
