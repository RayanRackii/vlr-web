import { CalendarDays } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DaySlotsTimeline } from "@/features/rentals/components/schedule/DaySlotsTimeline"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { SchedulePolicyPanel } from "@/features/rentals/components/schedule/SchedulePolicyPanel"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
  UpdateSchedulePolicyInput,
} from "@/features/rentals/services/scheduleService"

type DailyAgendaTabProps = {
  assets: readonly AdminRentalAsset[]
  rentalAssetId: string
  date: string
  day: AdminDaySchedule | null
  loading: boolean
  busy: boolean
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
  busy,
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

  const isOpenHours = (selectedAsset?.schedulePolicy ?? "SlotGrid") === "OpenHours"

  if (assets.length === 0) {
    return (
      <ScheduleEmptyState
        icon={CalendarDays}
        title={t("rentals.schedule.noAssets")}
      />
    )
  }

  const slotsEmpty = !day || day.slots.length === 0

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
        readOnly={readOnly}
        onSave={onSavePolicy}
        onSeedSlotGrid={onSeedTemplates}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : slotsEmpty ? (
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
              <Button
                type="button"
                variant="outline"
                disabled={busy || readOnly || !rentalAssetId}
                onClick={onSeedTemplates}
              >
                {t("rentals.schedule.seedTemplates")}
              </Button>
            ) : !isOpenHours ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy || readOnly || !rentalAssetId}
                onClick={onPublish}
              >
                {t("rentals.schedule.publishDay")}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium">{t("rentals.schedule.dayTitle")}</h2>
            {!isOpenHours ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || readOnly || !rentalAssetId}
                  onClick={onSeedTemplates}
                >
                  {t("rentals.schedule.seedTemplates")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || readOnly || !rentalAssetId}
                  onClick={onPublish}
                >
                  {t("rentals.schedule.publishDay")}
                </Button>
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
