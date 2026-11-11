import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { CalendarClock } from "lucide-react"

import { occupancyKindDisplayLabel } from "@/features/rentals/lib/occupancyKindLabel"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InlineScheduleModule } from "@/features/rentals/components/schedule/InlineScheduleModule"
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
  onDirtyChange?: (dirty: boolean) => void
  /** Collapse and other non-Cancel closes. Cancel discards without asking. */
  onRequestClose?: () => void
}

export function DaySlotSheet(props: DaySlotSheetProps) {
  const { target } = props
  if (!target || !props.open) {
    return null
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
  onDirtyChange,
  onRequestClose,
}: DaySlotSheetProps & { target: DayResourceGridCellPayload }) {
  const { t } = useTranslation()
  const slot = target.slot
  const initialKindId = slot?.occupancyKindId ?? defaultKindId
  const initialLabel = slot?.label ?? ""
  const [draft, setDraft] = useState<DaySlotDraft>({
    occupancyKindId: initialKindId,
    label: initialLabel,
  })
  const [scope, setScope] = useState<OccurrenceEditScope>("OnlyThisDay")
  const activeKinds = useMemo(
    () =>
      kinds.filter(
        (kind) => kind.isActive || kind.id === draft.occupancyKindId,
      ),
    [draft.occupancyKindId, kinds],
  )
  const isInternalUse = slot?.isInternalUseOrigin === true
  const workStart = slot?.workStartTime ?? null
  const workEnd = slot?.workEndTime ?? null
  const owningOrderId = slot?.owningCatalogOrderId ?? null
  const hasPrepBuffer = Boolean(workStart) && workStart !== target.startTime
  const hasCleanupBuffer = Boolean(workEnd) && workEnd !== target.endTime
  const isBooked = slot?.status === "Booked" || Boolean(slot?.reservationId)
  const isUnavailable = slot?.status === "Cancelled"
  const isOverride = slot?.source === "DailyOverride"
  const supportsEntireRecurrence = Boolean(slot?.supportsEntireRecurrence)
  const statusKey = isBooked
    ? "booked"
    : isUnavailable || (slot && !slot.isBookableByCustomer)
      ? "unavailable"
      : "available"
  const dirty = !isBooked && !isInternalUse && (
    draft.occupancyKindId !== initialKindId
    || draft.label !== initialLabel
    || scope !== "OnlyThisDay"
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  return (
    <InlineScheduleModule
      title={t("rentals.schedule.occurrence.editTitle")}
      description={(
        <>
          {target.assetName}
          <span className="block">
            {formatDisplayDate(target.date)} · {formatScheduleTime(target.startTime)}–
            {formatScheduleTime(target.endTime)}
          </span>
        </>
      )}
      icon={CalendarClock}
      open={open}
      disabled={busy}
      onOpenChange={(next) => {
        if (!next && onRequestClose) {
          onRequestClose()
          return
        }
        onOpenChange(next)
      }}
    >
        <div className="flex flex-col gap-5">
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

          {isInternalUse ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{t("rentals.schedule.occurrence.internalUse")}</p>
              {workStart && workEnd ? (
                <p className="text-muted-foreground">
                  {t("rentals.schedule.occurrence.workWindow")}:{" "}
                  <span className="tabular-nums text-foreground">
                    {formatScheduleTime(workStart)}–{formatScheduleTime(workEnd)}
                  </span>
                </p>
              ) : null}
              {hasPrepBuffer || hasCleanupBuffer ? (
                <ul className="space-y-1 text-muted-foreground">
                  {hasPrepBuffer ? (
                    <li>
                      {t("rentals.schedule.occurrence.prepBuffer")}:{" "}
                      <span className="tabular-nums">
                        {formatScheduleTime(target.startTime)}–{formatScheduleTime(workStart!)}
                      </span>
                    </li>
                  ) : null}
                  {hasCleanupBuffer ? (
                    <li>
                      {t("rentals.schedule.occurrence.cleanupBuffer")}:{" "}
                      <span className="tabular-nums">
                        {formatScheduleTime(workEnd!)}–{formatScheduleTime(target.endTime)}
                      </span>
                    </li>
                  ) : null}
                </ul>
              ) : null}
              {owningOrderId ? (
                <Link
                  to={`/pedidos/${owningOrderId}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("rentals.schedule.occurrence.viewOrder")}
                </Link>
              ) : (
                <p className="text-muted-foreground">
                  {t("rentals.schedule.occurrence.linkedToOrder")}
                </p>
              )}
            </div>
          ) : isBooked ? (
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
                <Select
                  modal={false}
                  value={draft.occupancyKindId || null}
                  disabled={busy || readOnly}
                  onValueChange={(value) => {
                    if (typeof value === "string") {
                      setDraft((current) => ({
                        ...current,
                        occupancyKindId: value,
                      }))
                    }
                  }}
                  items={activeKinds.map((kind) => ({
                    value: kind.id,
                    label: occupancyKindDisplayLabel(t, kind),
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeKinds.map((kind) => (
                      <SelectItem key={kind.id} value={kind.id}>
                        {occupancyKindDisplayLabel(t, kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

        <div className="flex gap-2">
          {isBooked || isInternalUse ? (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <div className="flex flex-1 gap-2">
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
        </div>
    </InlineScheduleModule>
  )
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return year && month && day ? `${day}/${month}/${year}` : isoDate
}
