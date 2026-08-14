import { useTranslation } from "react-i18next"

import {
  formatScheduleTime,
  type AdminDaySchedule,
} from "@/features/rentals/services/scheduleService"
import { cn } from "@/lib/utils"

type DaySlotsTimelineProps = {
  slots: AdminDaySchedule["slots"]
}

export function DaySlotsTimeline({ slots }: DaySlotsTimelineProps) {
  const { t } = useTranslation()
  const ordered = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <ol className="relative space-y-3 border-l border-border pl-6">
      {ordered.map((slot) => {
        const accent = slot.occupancyKindColorHex?.trim() || undefined

        return (
          <li key={`${slot.id}-${slot.startTime}-${slot.status}`} className="relative">
            <span
              className="absolute -left-[1.6rem] top-4 size-2.5 rounded-full border-2 border-background bg-muted-foreground"
              style={accent ? { backgroundColor: accent } : undefined}
              aria-hidden
            />
            <div
              className={cn(
                "rounded-lg border border-border bg-background px-4 py-3",
                accent ? "border-l-4" : undefined,
              )}
              style={accent ? { borderLeftColor: accent } : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium tabular-nums">
                    {formatScheduleTime(slot.startTime)} –{" "}
                    {formatScheduleTime(slot.endTime)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {slot.occupancyKindLabel}
                    {slot.label ? ` · ${slot.label}` : ""}
                  </p>
                </div>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {slot.status}
                </span>
              </div>
              {!slot.isBookableByCustomer ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("rentals.schedule.kinds.notBookable")}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
