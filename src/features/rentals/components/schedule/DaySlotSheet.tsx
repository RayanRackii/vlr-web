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
import type { DayResourceGridCellPayload } from "@/features/rentals/components/schedule/DayResourceGrid"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import {
  formatScheduleTime,
  type OccurrenceEditScope,
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
  target: DayResourceGridCellPayload | null
  kinds: readonly OccupancyKind[]
  defaultKindId: string
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  onSave: (
    draft: DaySlotDraft,
    scope: OccurrenceEditScope,
  ) => Promise<boolean>
  onMakeUnavailable: (scope: OccurrenceEditScope) => Promise<boolean>
  onRestoreWeeklyDefault: () => Promise<boolean>
  onGoWeeklySetup?: () => void
}

export function DaySlotSheet(props: DaySlotSheetProps) {
  const { target, open, onOpenChange } = props
  if (!target) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[420px]" />
      </Sheet>
    )
  }

  return (
    <DaySlotSheetForm
      key={`${target.rentalAssetId}|${target.date}|${target.startTime}|${target.slot?.id ?? "empty"}`}
      {...props}
      target={target}
    />
  )
}

function DaySlotSheetForm({
  open,
  onOpenChange,
  target,
  kinds,
  defaultKindId,
  busy,
  busyAction,
  readOnly,
  onSave,
  onMakeUnavailable,
  onRestoreWeeklyDefault,
  onGoWeeklySetup,
}: DaySlotSheetProps & { target: DayResourceGridCellPayload }) {
  const { t } = useTranslation()
  const slot = target.slot
  const [draft, setDraft] = useState<DaySlotDraft>({
    occupancyKindId: slot?.occupancyKindId ?? defaultKindId,
    label: slot?.label ?? "",
  })
  const [scope, setScope] = useState<OccurrenceEditScope>("OnlyThisDay")
  const activeKinds = useMemo(
    () =>
      kinds.filter(
        (kind) => kind.isActive || kind.id === draft.occupancyKindId,
      ),
    [draft.occupancyKindId, kinds],
  )
  const isBooked = slot?.status === "Booked" || Boolean(slot?.reservationId)
  const isUnavailable = slot?.status === "Cancelled"
  const isOverride = slot?.source === "DailyOverride"
  const supportsEntireRecurrence = Boolean(slot?.supportsEntireRecurrence)
  const statusKey = isBooked
    ? "booked"
    : isUnavailable || (slot && !slot.isBookableByCustomer)
      ? "unavailable"
      : "available"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px]">
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("rentals.schedule.occurrence.editTitle")}</SheetTitle>
          <SheetDescription>
            {target.assetName}
            <span className="block">
              {formatDisplayDate(target.date)} · {formatScheduleTime(target.startTime)}–
              {formatScheduleTime(target.endTime)}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "size-2.5 rounded-full",
                statusKey === "available" && "bg-emerald-500",
                statusKey === "booked" && "bg-amber-500",
                statusKey === "unavailable" && "bg-slate-500",
              )}
            />
            <span className="font-medium">
              {t(`rentals.schedule.occurrence.status.${statusKey}`)}
            </span>
            {isOverride ? (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {t("rentals.schedule.occurrence.source.dailyOverride")}
              </span>
            ) : null}
          </div>

          {isBooked ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <p className="font-medium">{t("rentals.schedule.occurrence.bookedTitle")}</p>
              <p>{t("rentals.schedule.occurrence.bookedDescription")}</p>
              <Link
                to="/configuracoes/reservas"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t("rentals.schedule.occurrence.openReservation")}
              </Link>
            </div>
          ) : (
            <>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t("rentals.schedule.templates.kind")}</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.occupancyKindId}
                  disabled={busy || readOnly}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      occupancyKindId: event.target.value,
                    }))
                  }
                >
                  {activeKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="font-medium">{t("rentals.schedule.templates.label")}</span>
                <Input
                  value={draft.label}
                  disabled={busy || readOnly}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, label: event.target.value }))
                  }
                />
              </label>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  {t("rentals.schedule.occurrence.applyScope")}
                </legend>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="occurrence-scope"
                    className="mt-0.5 size-4 accent-primary"
                    checked={scope === "OnlyThisDay"}
                    disabled={busy || readOnly}
                    onChange={() => setScope("OnlyThisDay")}
                  />
                  {t("rentals.schedule.occurrence.onlyThisDay")}
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="occurrence-scope"
                    className="mt-0.5 size-4 accent-primary"
                    checked={scope === "EntireRecurrence"}
                    disabled={busy || readOnly || !supportsEntireRecurrence}
                    onChange={() => setScope("EntireRecurrence")}
                  />
                  <span>
                    {t("rentals.schedule.occurrence.entireRecurrence")}
                    {!supportsEntireRecurrence ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("rentals.schedule.occurrence.entireRecurrenceDisabledHint")}
                        {onGoWeeklySetup ? (
                          <Button
                            type="button"
                            variant="link"
                            size="xs"
                            className="ml-1 h-auto p-0"
                            onClick={onGoWeeklySetup}
                          >
                            {t("rentals.schedule.tabs.templates")}
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </label>
              </fieldset>

              {slot && !isUnavailable ? (
                <LoadingButton
                  type="button"
                  variant="outline"
                  loading={busyAction === "slotUnavailable"}
                  disabled={busy || readOnly}
                  onClick={() =>
                    void onMakeUnavailable(scope).then((ok) => {
                      if (ok) onOpenChange(false)
                    })
                  }
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
                  onClick={() =>
                    void onRestoreWeeklyDefault().then((ok) => {
                      if (ok) onOpenChange(false)
                    })
                  }
                >
                  {t("rentals.schedule.occurrence.restoreWeekly")}
                </LoadingButton>
              ) : null}
            </>
          )}
        </div>

        <SheetFooter className="border-t border-border bg-background">
          {isBooked ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <LoadingButton
                type="button"
                className="flex-1"
                loading={busyAction === "slotUpdate"}
                disabled={busy || readOnly || !draft.occupancyKindId}
                onClick={() =>
                  void onSave(draft, scope).then((ok) => {
                    if (ok) onOpenChange(false)
                  })
                }
              >
                {t("common.save")}
              </LoadingButton>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return year && month && day ? `${day}/${month}/${year}` : isoDate
}
