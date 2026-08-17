import { CalendarRange, ChevronLeft, ChevronRight, Settings2, SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import { DayResourceGrid } from "@/features/rentals/components/schedule/DayResourceGrid"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { ScheduleDaySlotsSkeleton } from "@/features/rentals/components/schedule/ScheduleDaySlotsSkeleton"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import { WeeklyRuleSheet } from "@/features/rentals/components/schedule/WeeklyRuleSheet"
import type { WeeklyRuleDraft } from "@/features/rentals/components/schedule/WeeklyRuleSheet"
import {
  buildWeeklyGridOccupancies,
  isOpenHoursOccupancyId,
  shiftWeekday,
  todayWeekdayName,
} from "@/features/rentals/components/schedule/scheduleGridModel"
import {
  DAY_NAMES,
  type AdminRentalAsset,
  type DayOfWeekName,
  type OccupancyKind,
  type ScheduleTemplate,
  type UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"

export type { WeeklyRuleDraft }

export type WeeklyGridCellPayload = {
  rentalAssetId: string
  assetName: string
  dayOfWeek: DayOfWeekName
  startTime: string
  endTime: string
  origin: "template" | "openHours" | "empty"
  template: ScheduleTemplate | null
}

type WeeklyTemplatesTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  weekday: DayOfWeekName
  templates: readonly ScheduleTemplate[]
  kinds: readonly OccupancyKind[]
  defaultKindId: string
  loading: boolean
  showSkeleton: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  busyTargetId: string | null
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onWeekdayChange: (weekday: DayOfWeekName) => void
  onCellClick: (payload: WeeklyGridCellPayload) => void
  onSeedSelected: () => void
  onSavePolicy: (input: UpdateSchedulePolicyInput) => Promise<void>
  onApplyWeeklyRule: (draft: WeeklyRuleDraft) => Promise<boolean>
}

export function WeeklyTemplatesTab({
  assets,
  selectedRentalAssetIds,
  weekday,
  templates,
  kinds,
  defaultKindId,
  loading,
  showSkeleton,
  busy,
  busyAction,
  busyTargetId,
  readOnly,
  onSelectedRentalAssetIdsChange,
  onWeekdayChange,
  onCellClick,
  onSeedSelected,
  onSavePolicy,
  onApplyWeeklyRule,
}: WeeklyTemplatesTabProps) {
  const { t } = useTranslation()
  const [policyOpen, setPolicyOpen] = useState(false)
  const [ruleOpen, setRuleOpen] = useState(false)

  const selectedAssets = useMemo(
    () =>
      assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )

  const occupancies = useMemo(
    () =>
      buildWeeklyGridOccupancies(selectedAssets, templates, kinds, weekday),
    [kinds, selectedAssets, templates, weekday],
  )

  if (assets.length === 0) {
    return (
      <ScheduleEmptyState
        icon={CalendarRange}
        title={t("rentals.schedule.noAssets")}
      />
    )
  }

  const showInlineRefresh = loading && !showSkeleton
  const hasSelection = selectedAssets.length > 0

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex items-center">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("rentals.schedule.toolbar.prevWeekday")}
            onClick={() => onWeekdayChange(shiftWeekday(weekday, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onWeekdayChange(todayWeekdayName())}
          >
            {t("rentals.schedule.toolbar.today")}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("rentals.schedule.toolbar.nextWeekday")}
            onClick={() => onWeekdayChange(shiftWeekday(weekday, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <select
          className="flex h-9 w-auto rounded-md border border-input bg-transparent px-3 text-sm"
          value={weekday}
          aria-label={t("rentals.schedule.templates.dayOfWeek")}
          onChange={(event) =>
            onWeekdayChange(event.target.value as DayOfWeekName)
          }
        >
          {DAY_NAMES.map((dayName) => (
            <option key={dayName} value={dayName}>
              {t(`rentals.schedule.days.${dayName}`)}
            </option>
          ))}
        </select>
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
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPolicyOpen(true)}
          >
            <Settings2 aria-hidden />
            {t("rentals.schedule.weekly.configureHours")}
          </Button>
          {selectedAssets.some(
            (asset) => (asset.schedulePolicy ?? "SlotGrid") === "SlotGrid",
          ) ? (
            <LoadingButton
              type="button"
              size="sm"
              variant="outline"
              loading={busyAction === "seed"}
              disabled={busy || readOnly || !hasSelection}
              onClick={onSeedSelected}
            >
              {t("rentals.schedule.seedTemplates")}
            </LoadingButton>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={busy || readOnly || !hasSelection}
            onClick={() => setRuleOpen(true)}
          >
            {t("rentals.schedule.weeklyRule.apply")}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        {t("rentals.schedule.weeklyBanner", {
          day: t(`rentals.schedule.days.${weekday}`),
        })}
      </div>

      <section className="min-w-0">
        {showInlineRefresh ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("common.refreshing")}
          </p>
        ) : null}
        {!hasSelection ? (
          <ScheduleEmptyState
            icon={CalendarRange}
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
            busyTargetKey={busyTargetId}
            readOnly={readOnly}
            onCellClick={(cell) => {
              const asset = selectedAssets.find(
                (item) => item.id === cell.rentalAssetId,
              )
              const policy = asset?.schedulePolicy ?? "SlotGrid"
              if (
                policy === "OpenHours" ||
                (cell.occupancy && isOpenHoursOccupancyId(cell.occupancy.id))
              ) {
                setPolicyOpen(true)
                return
              }
              const template = cell.occupancy
                ? (templates.find((row) => row.id === cell.occupancy?.id) ?? null)
                : null
              onCellClick({
                rentalAssetId: cell.rentalAssetId,
                assetName: cell.assetName,
                dayOfWeek: weekday,
                startTime: cell.startTime,
                endTime: cell.endTime,
                origin: template ? "template" : "empty",
                template,
              })
            }}
          />
        )}
      </section>

      <Sheet open={policyOpen} onOpenChange={setPolicyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("rentals.schedule.policy.title")}</SheetTitle>
            <SheetDescription>
              {t("rentals.schedule.policy.description")}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-4">
            {selectedAssets.length > 0 ? (
              <SchedulePolicyPanel
                assets={selectedAssets}
                busy={busy}
                busyAction={busyAction}
                readOnly={readOnly}
                embedded
                onSave={onSavePolicy}
                onSeedSlotGrid={onSeedSelected}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <WeeklyRuleSheet
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        selectedRentalAssetIds={selectedRentalAssetIds}
        weekday={weekday}
        kinds={kinds}
        defaultKindId={defaultKindId}
        busy={busy}
        busyAction={busyAction}
        readOnly={readOnly}
        onApply={onApplyWeeklyRule}
      />
    </div>
  )
}
