import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DayResourceGrid,
  type DayResourceGridCellPayload,
} from "@/features/rentals/components/schedule/DayResourceGrid"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { ScheduleDaySlotsSkeleton } from "@/features/rentals/components/schedule/ScheduleDaySlotsSkeleton"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import { occupancyFromDaySlot } from "@/features/rentals/components/schedule/scheduleGridModel"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"

export type ScheduleBusyAction =
  | "publish"
  | "seed"
  | "policy"
  | "template"
  | "templateDelete"
  | "templateToggle"
  | "kind"
  | "slotUpdate"
  | "slotUnavailable"
  | "slotRestore"
  | "weeklyRule"
  | null

type DailyAgendaTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  date: string
  day: AdminDaySchedule | null
  loading: boolean
  showSkeleton: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  busyTargetKey: string | null
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onDateChange: (date: string) => void
  onPublish: () => void
  onSlotOrCellClick: (payload: DayResourceGridCellPayload) => void
  onGoWeeklySetup?: () => void
}

function addDays(isoDate: string, amount: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function DailyAgendaTab({
  assets,
  selectedRentalAssetIds,
  date,
  day,
  loading,
  showSkeleton,
  busy,
  busyAction,
  busyTargetKey,
  readOnly,
  onSelectedRentalAssetIdsChange,
  onDateChange,
  onPublish,
  onSlotOrCellClick,
  onGoWeeklySetup,
}: DailyAgendaTabProps) {
  const { t } = useTranslation()

  const selectedAssets = useMemo(
    () =>
      assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )

  const occupancies = useMemo(
    () => (day?.slots ?? []).map(occupancyFromDaySlot),
    [day],
  )

  const hasSlotGrid = selectedAssets.some(
    (asset) => (asset.schedulePolicy ?? "SlotGrid") === "SlotGrid",
  )

  if (assets.length === 0) {
    return (
      <ScheduleEmptyState
        icon={CalendarDays}
        title={t("rentals.schedule.noAssets")}
      />
    )
  }

  const showInlineRefresh = loading && !showSkeleton && day !== null
  const hasSelection = selectedAssets.length > 0

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex items-center">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("rentals.schedule.toolbar.prev")}
            onClick={() => onDateChange(addDays(date, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDateChange(todayIsoDate())}
          >
            {t("rentals.schedule.toolbar.today")}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("rentals.schedule.toolbar.next")}
            onClick={() => onDateChange(addDays(date, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Input
          type="date"
          value={date}
          className="w-auto"
          onChange={(event) => onDateChange(event.target.value)}
        />
        <Popover>
          <PopoverTrigger
            render={<Button type="button" variant="outline" size="sm" />}
          >
            <SlidersHorizontal aria-hidden />
            {t("rentals.schedule.toolbar.resources", {
              selected: selectedRentalAssetIds.length,
              total: assets.length,
            })}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-4">
            <RentableMultiSelect
              assets={assets}
              selectedIds={selectedRentalAssetIds}
              onChange={onSelectedRentalAssetIdsChange}
            />
          </PopoverContent>
        </Popover>
        {hasSlotGrid ? (
          <LoadingButton
            type="button"
            size="sm"
            className="ml-auto"
            loading={busyAction === "publish"}
            disabled={busy || readOnly}
            onClick={onPublish}
          >
            {t("rentals.schedule.publishDay")}
          </LoadingButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <span>{t("rentals.schedule.dayOnlyBanner", { date })}</span>
        {onGoWeeklySetup ? (
          <Button type="button" variant="link" size="xs" onClick={onGoWeeklySetup}>
            {t("rentals.schedule.tabs.templates")}
          </Button>
        ) : null}
      </div>

      <section className="min-w-0">
        {showInlineRefresh ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("common.refreshing")}
          </p>
        ) : null}
        {!hasSelection ? (
          <ScheduleEmptyState
            icon={CalendarDays}
            title={t("rentals.schedule.grid.noSelection")}
          />
        ) : showSkeleton ? (
          <div role="status" aria-live="polite">
            <p className="sr-only">{t("common.loading")}</p>
            <ScheduleDaySlotsSkeleton columns={Math.min(selectedAssets.length, 5)} />
          </div>
        ) : (
          <DayResourceGrid
            assets={selectedAssets}
            occupancies={occupancies}
            busyTargetKey={busyTargetKey}
            readOnly={readOnly}
            onCellClick={(cell) => {
              const slot = cell.occupancy
                ? (day?.slots.find((item) => item.id === cell.occupancy?.id) ??
                  null)
                : null
              onSlotOrCellClick({
                rentalAssetId: cell.rentalAssetId,
                assetName: cell.assetName,
                date,
                startTime: cell.startTime,
                endTime: cell.endTime,
                occupancy: cell.occupancy,
                slot,
              })
            }}
          />
        )}
      </section>
    </div>
  )
}
