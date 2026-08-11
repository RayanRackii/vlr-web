import { CalendarDays } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DaySlotsTimeline } from "@/features/rentals/components/schedule/DaySlotsTimeline"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
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
}: DailyAgendaTabProps) {
  const { t } = useTranslation()

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
    <div className="space-y-6">
      <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("rentals.schedule.rentable")}</span>
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
                {asset.schedulePolicy ? ` (${asset.schedulePolicy})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("rentals.schedule.date")}</span>
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              onDateChange(event.target.value)
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{t("rentals.schedule.dayTitle")}</h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || readOnly || !rentalAssetId}
          onClick={onPublish}
        >
          {t("rentals.schedule.publishDay")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : slotsEmpty ? (
        <ScheduleEmptyState
          icon={CalendarDays}
          title={t("rentals.schedule.dayEmptyTitle")}
          description={
            hasTemplates
              ? t("rentals.schedule.dayEmptyDescription")
              : t("rentals.schedule.dayEmptyNoTemplates")
          }
          actionLabel={
            hasTemplates
              ? t("rentals.schedule.publishFromTemplate")
              : t("rentals.schedule.seedTemplates")
          }
          actionDisabled={busy || readOnly || !rentalAssetId}
          onAction={hasTemplates ? onPublish : onSeedTemplates}
          secondaryAction={
            hasTemplates ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || readOnly || !rentalAssetId}
                onClick={onSeedTemplates}
              >
                {t("rentals.schedule.seedTemplates")}
              </Button>
            ) : null
          }
        />
      ) : day ? (
        <DaySlotsTimeline day={day} />
      ) : null}
    </div>
  )
}
