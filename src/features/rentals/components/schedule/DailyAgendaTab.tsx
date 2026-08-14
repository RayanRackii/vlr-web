import { CalendarDays } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { DaySlotsTimeline } from "@/features/rentals/components/schedule/DaySlotsTimeline"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { ScheduleDaySlotsSkeleton } from "@/features/rentals/components/schedule/ScheduleDaySlotsSkeleton"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import type {
  AdminDaySchedule,
  AdminDaySlot,
  AdminRentalAsset,
  ScheduleTemplate,
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
  | null

type DailyAgendaTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  date: string
  day: AdminDaySchedule | null
  templates: readonly ScheduleTemplate[]
  /** True while fetching day data. */
  loading: boolean
  /** First paint for this day/unit with no slots yet → shimmer skeleton. */
  showSkeleton: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  busyTargetKey: string | null
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onDateChange: (date: string) => void
  onPublish: () => void
  onSlotClick: (slot: AdminDaySlot) => void
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  if (!year || !month || !day) {
    return isoDate
  }
  return `${day}/${month}/${year}`
}

export function DailyAgendaTab({
  assets,
  selectedRentalAssetIds,
  date,
  day,
  templates,
  loading,
  showSkeleton,
  busy,
  busyAction,
  busyTargetKey,
  readOnly,
  onSelectedRentalAssetIdsChange,
  onDateChange,
  onPublish,
  onSlotClick,
}: DailyAgendaTabProps) {
  const { t } = useTranslation()

  const selectedAssets = useMemo(
    () =>
      assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
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
  const dateLabel = formatDisplayDate(date)

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

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">
              {t("rentals.schedule.date")}
            </span>
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                onDateChange(event.target.value)
              }}
            />
            {hasSlotGrid ? (
              <LoadingButton
                type="button"
                className="mt-3 w-full"
                loading={busyAction === "publish"}
                disabled={busy || readOnly}
                onClick={onPublish}
              >
                {t("rentals.schedule.publishDay")}
              </LoadingButton>
            ) : null}
          </label>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("rentals.schedule.dayOnlyBanner", { date: dateLabel })}
          </p>
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        {showInlineRefresh ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("common.refreshing")}
          </p>
        ) : null}
        {!hasSelection ? (
          <ScheduleEmptyState
            icon={CalendarDays}
            title={t("rentals.schedule.noneSelectedTitle")}
            description={t("rentals.schedule.noneSelectedDescription")}
          />
        ) : showSkeleton ? (
          <div
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
            role="status"
            aria-live="polite"
          >
            <p className="sr-only">{t("common.loading")}</p>
            <ScheduleDaySlotsSkeleton />
          </div>
        ) : (
          <div className="space-y-4">
            {selectedAssets.map((asset) => {
              const slots =
                day?.slots.filter(
                  (slot) => slot.rentalAssetId === asset.id,
                ) ?? []
              const isOpenHours =
                (asset.schedulePolicy ?? "SlotGrid") === "OpenHours"
              const hasTemplates = templates.some(
                (row) => row.rentalAssetId === asset.id,
              )

              return (
                <article
                  key={asset.id}
                  className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <h3 className="text-sm font-medium text-foreground">
                      {asset.name}
                    </h3>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {t("rentals.schedule.slotCount", {
                        count: slots.length,
                      })}
                    </span>
                  </div>
                  {slots.length === 0 ? (
                    <ScheduleEmptyState
                      icon={CalendarDays}
                      className="px-4 py-8"
                      title={
                        isOpenHours
                          ? t("rentals.schedule.dayEmptyOpenHoursTitle")
                          : t("rentals.schedule.dayEmptyTitle")
                      }
                      description={
                        isOpenHours
                          ? t("rentals.schedule.dayEmptyOpenHoursDescription")
                          : hasTemplates
                            ? t("rentals.schedule.dayEmptyDescription")
                            : t("rentals.schedule.dayEmptyNoTemplates")
                      }
                    />
                  ) : (
                    <DaySlotsTimeline
                      slots={slots}
                      readOnly={readOnly}
                      busyTargetKey={busyTargetKey}
                      onSlotClick={onSlotClick}
                    />
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
