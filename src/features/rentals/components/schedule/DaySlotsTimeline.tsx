import { useTranslation } from "react-i18next"

import {
  formatScheduleTime,
  type AdminDaySlot,
} from "@/features/rentals/services/scheduleService"
import { cn } from "@/lib/utils"

type DaySlotsTimelineProps = {
  slots: readonly AdminDaySlot[]
  readOnly?: boolean
  busyTargetKey?: string | null
  onSlotClick?: (slot: AdminDaySlot) => void
}

function slotKey(slot: AdminDaySlot): string {
  return `${slot.rentalAssetId}|${slot.startTime}|${slot.id}`
}

export function DaySlotsTimeline({
  slots,
  readOnly = false,
  busyTargetKey = null,
  onSlotClick,
}: DaySlotsTimelineProps) {
  const { t } = useTranslation()
  const ordered = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <ul className="space-y-3">
      {ordered.map((slot) => {
        const accent = slot.occupancyKindColorHex?.trim() || undefined
        const key = slotKey(slot)
        const isBusy = busyTargetKey === key
        const statusKey =
          slot.status === "Booked"
            ? "booked"
            : slot.status === "Cancelled"
              ? "unavailable"
              : "available"
        const sourceKey =
          slot.source === "DailyOverride" ? "dailyOverride" : "weeklyDefault"
        const interactive = Boolean(onSlotClick) && !readOnly

        const body = (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5 text-left">
                <p className="text-sm font-medium tabular-nums">
                  {formatScheduleTime(slot.startTime)} –{" "}
                  {formatScheduleTime(slot.endTime)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {slot.occupancyKindLabel}
                  {slot.label ? ` · ${slot.label}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`rentals.schedule.occurrence.source.${sourceKey}`)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs",
                  statusKey === "booked"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                    : statusKey === "unavailable"
                      ? "bg-muted text-muted-foreground line-through"
                      : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
                )}
              >
                {t(`rentals.schedule.occurrence.status.${statusKey}`)}
              </span>
            </div>
            {!slot.isBookableByCustomer && statusKey === "available" ? (
              <p className="mt-2 text-left text-xs text-muted-foreground">
                {t("rentals.schedule.kinds.notBookable")}
              </p>
            ) : null}
            {isBusy ? (
              <p className="mt-2 text-left text-xs text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : null}
          </>
        )

        const className = cn(
          "w-full rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors",
          accent ? "border-l-4" : undefined,
          statusKey === "unavailable" ? "opacity-80" : undefined,
          interactive
            ? "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            : undefined,
        )

        return (
          <li key={key}>
            {interactive ? (
              <button
                type="button"
                className={className}
                style={accent ? { borderLeftColor: accent } : undefined}
                disabled={isBusy}
                onClick={() => {
                  onSlotClick?.(slot)
                }}
              >
                {body}
              </button>
            ) : (
              <div
                className={className}
                style={accent ? { borderLeftColor: accent } : undefined}
              >
                {body}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
