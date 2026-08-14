import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import {
  formatScheduleTime,
  type AdminDaySlot,
  type OccupancyKind,
} from "@/features/rentals/services/scheduleService"
import { cn } from "@/lib/utils"

export type DaySlotDraft = {
  occupancyKindId: string
  label: string
}

type DaySlotSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: AdminDaySlot | null
  kinds: readonly OccupancyKind[]
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  onSave: (draft: DaySlotDraft) => Promise<boolean>
  onMakeUnavailable: () => Promise<boolean>
  onRestoreWeeklyDefault: () => Promise<boolean>
}

export function DaySlotSheet({
  open,
  onOpenChange,
  slot,
  kinds,
  busy,
  busyAction,
  readOnly,
  onSave,
  onMakeUnavailable,
  onRestoreWeeklyDefault,
}: DaySlotSheetProps) {
  if (!slot) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    )
  }

  return (
    <DaySlotSheetForm
      key={`${slot.id}|${slot.startTime}|${slot.status}|${slot.occupancyKindId}|${slot.label ?? ""}`}
      open={open}
      onOpenChange={onOpenChange}
      slot={slot}
      kinds={kinds}
      busy={busy}
      busyAction={busyAction}
      readOnly={readOnly}
      onSave={onSave}
      onMakeUnavailable={onMakeUnavailable}
      onRestoreWeeklyDefault={onRestoreWeeklyDefault}
    />
  )
}

function DaySlotSheetForm({
  open,
  onOpenChange,
  slot,
  kinds,
  busy,
  busyAction,
  readOnly,
  onSave,
  onMakeUnavailable,
  onRestoreWeeklyDefault,
}: DaySlotSheetProps & { slot: AdminDaySlot }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<DaySlotDraft>({
    occupancyKindId: slot.occupancyKindId,
    label: slot.label ?? "",
  })

  const isBooked = slot.status === "Booked"
  const isUnavailable = slot.status === "Cancelled"
  const isOverride = slot.source === "DailyOverride"
  const activeKinds = useMemo(
    () => kinds.filter((kind) => kind.isActive),
    [kinds],
  )
  const dateLabel = formatDisplayDate(slot.date)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("rentals.schedule.occurrence.sheetTitle")}</SheetTitle>
          <SheetDescription>
            {t("rentals.schedule.occurrence.sheetDescription", {
              date: dateLabel,
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm">
            <p className="font-medium text-foreground">{slot.assetName}</p>
            <p className="mt-1 tabular-nums text-muted-foreground">
              {formatScheduleTime(slot.startTime)} –{" "}
              {formatScheduleTime(slot.endTime)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                `rentals.schedule.occurrence.source.${
                  isOverride ? "dailyOverride" : "weeklyDefault"
                }`,
              )}
            </p>
          </div>

          {isBooked ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="font-medium text-amber-950 dark:text-amber-100">
                {t("rentals.schedule.occurrence.bookedTitle")}
              </p>
              <p className="text-amber-900/90 dark:text-amber-100/90">
                {t("rentals.schedule.occurrence.bookedDescription")}
              </p>
              {slot.reservationId ? (
                <Link
                  to="/configuracoes/reservas"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                  )}
                >
                  {t("rentals.schedule.occurrence.openReservation")}
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">
                  {t("rentals.schedule.templates.kind")}
                </span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={draft.occupancyKindId}
                  disabled={busy || readOnly}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      occupancyKindId: event.target.value,
                    }))
                  }}
                >
                  {activeKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">
                  {t("rentals.schedule.templates.label")}
                </span>
                <Input
                  value={draft.label}
                  disabled={busy || readOnly}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }}
                />
              </label>

              <p className="text-xs text-muted-foreground">
                {t("rentals.schedule.occurrence.dayOnlyHint", {
                  date: dateLabel,
                })}
              </p>
            </>
          )}
        </div>

        <SheetFooter className="mt-8 flex flex-col gap-2 sm:flex-col">
          {isBooked ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
              }}
            >
              {t("common.close")}
            </Button>
          ) : (
            <>
              <LoadingButton
                type="button"
                loading={busyAction === "slotUpdate"}
                disabled={busy || readOnly || !draft.occupancyKindId}
                onClick={() => {
                  void onSave(draft).then((ok) => {
                    if (ok) {
                      onOpenChange(false)
                    }
                  })
                }}
              >
                {t("rentals.schedule.occurrence.saveDay")}
              </LoadingButton>

              {!isUnavailable ? (
                <LoadingButton
                  type="button"
                  variant="outline"
                  loading={busyAction === "slotUnavailable"}
                  disabled={busy || readOnly}
                  onClick={() => {
                    void onMakeUnavailable().then((ok) => {
                      if (ok) {
                        onOpenChange(false)
                      }
                    })
                  }}
                >
                  {t("rentals.schedule.occurrence.makeUnavailable")}
                </LoadingButton>
              ) : null}

              {isOverride || isUnavailable ? (
                <LoadingButton
                  type="button"
                  variant="secondary"
                  loading={busyAction === "slotRestore"}
                  disabled={busy || readOnly}
                  onClick={() => {
                    void onRestoreWeeklyDefault().then((ok) => {
                      if (ok) {
                        onOpenChange(false)
                      }
                    })
                  }}
                >
                  {t("rentals.schedule.occurrence.restoreWeekly")}
                </LoadingButton>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  onOpenChange(false)
                }}
              >
                {t("common.cancel")}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  if (!year || !month || !day) {
    return isoDate
  }
  return `${day}/${month}/${year}`
}
