import { CalendarDays, Loader2 } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { DaySlotsTimeline } from "@/features/rentals/components/schedule/DaySlotsTimeline"
import { ScheduleDaySlotsSkeleton } from "@/features/rentals/components/schedule/ScheduleDaySlotsSkeleton"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
  UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"

export type ScheduleBusyAction =
  | "publish"
  | "seed"
  | "policy"
  | "template"
  | "templateDelete"
  | "templateToggle"
  | "kind"
  | null

type DailyAgendaTabProps = {
  assets: readonly AdminRentalAsset[]
  rentalAssetId: string
  date: string
  day: AdminDaySchedule | null
  /** True while fetching day data. */
  loading: boolean
  /** First paint for this day/unit with no slots yet → shimmer skeleton. */
  showSkeleton: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  hasTemplates: boolean
  onRentalAssetChange: (id: string) => void
  onDateChange: (date: string) => void
  onPublish: () => void
  onSeedTemplates: () => void
  onSavePolicy: (input: UpdateSchedulePolicyInput) => Promise<void>
}

export function DailyAgendaTab({
  assets,
  rentalAssetId,
  date,
  day,
  loading,
  showSkeleton,
  busy,
  busyAction,
  readOnly,
  hasTemplates,
  onRentalAssetChange,
  onDateChange,
  onPublish,
  onSeedTemplates,
  onSavePolicy,
}: DailyAgendaTabProps) {
  const { t } = useTranslation()

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === rentalAssetId) ?? null,
    [assets, rentalAssetId],
  )

  const isOpenHours =
    (selectedAsset?.schedulePolicy ?? "SlotGrid") === "OpenHours"

  if (assets.length === 0) {
    return (
      <ScheduleEmptyState
        icon={CalendarDays}
        title={t("rentals.schedule.noAssets")}
      />
    )
  }

  const slotsEmpty = !day || day.slots.length === 0
  const showInlineRefresh = loading && !showSkeleton && day !== null

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1.5 text-sm">
          <span className="font-medium text-foreground">
            {t("rentals.schedule.rentable")}
          </span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={rentalAssetId}
            onChange={(event) => {
              onRentalAssetChange(event.target.value)
            }}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
                {asset.schedulePolicy === "OpenHours"
                  ? ` (${t("rentals.schedule.policy.openHours")})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full space-y-1.5 text-sm sm:max-w-[14rem]">
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
        </label>
      </div>

      <SchedulePolicyPanel
        asset={selectedAsset}
        busy={busy}
        busyAction={busyAction}
        readOnly={readOnly}
        onSave={onSavePolicy}
        onSeedSlotGrid={onSeedTemplates}
      />

      {showSkeleton ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="sr-only">{t("common.loading")}</p>
          <ScheduleDaySlotsSkeleton />
        </div>
      ) : slotsEmpty && !loading ? (
        <ScheduleEmptyState
          icon={CalendarDays}
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
          actionLabel={
            isOpenHours
              ? t("rentals.schedule.policy.saveOpenHours")
              : hasTemplates
                ? t("rentals.schedule.publishFromTemplate")
                : t("rentals.schedule.seedTemplates")
          }
          actionDisabled={busy || readOnly || !rentalAssetId}
          actionLoading={
            busyAction === "publish" ||
            busyAction === "seed" ||
            busyAction === "policy"
          }
          onAction={
            isOpenHours
              ? () => {
                  void onSavePolicy({
                    schedulePolicy: "OpenHours",
                    openTime: selectedAsset?.openTime
                      ? selectedAsset.openTime.slice(0, 5)
                      : "08:00",
                    closeTime: selectedAsset?.closeTime
                      ? selectedAsset.closeTime.slice(0, 5)
                      : "22:00",
                    allowedDurationMinutes:
                      selectedAsset?.allowedDurationMinutes ?? "60",
                  })
                }
              : hasTemplates
                ? onPublish
                : onSeedTemplates
          }
          secondaryAction={
            !isOpenHours && hasTemplates ? (
              <LoadingButton
                type="button"
                variant="outline"
                loading={busyAction === "seed"}
                disabled={busy || readOnly || !rentalAssetId}
                onClick={onSeedTemplates}
              >
                {t("rentals.schedule.seedTemplates")}
              </LoadingButton>
            ) : !isOpenHours ? (
              <LoadingButton
                type="button"
                variant="outline"
                loading={busyAction === "publish"}
                disabled={busy || readOnly || !rentalAssetId}
                onClick={onPublish}
              >
                {t("rentals.schedule.publishDay")}
              </LoadingButton>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">
                {t("rentals.schedule.dayTitle")}
              </h2>
              {showInlineRefresh ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  {t("common.refreshing")}
                </span>
              ) : null}
            </div>
            {!isOpenHours ? (
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
                <LoadingButton
                  type="button"
                  size="sm"
                  loading={busyAction === "publish"}
                  disabled={busy || readOnly || !rentalAssetId}
                  onClick={onPublish}
                >
                  {t("rentals.schedule.publishDay")}
                </LoadingButton>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("rentals.schedule.policy.derivedSlotsHint")}
              </p>
            )}
          </div>
          {day ? <DaySlotsTimeline day={day} /> : null}
        </div>
      )}
    </div>
  )
}
