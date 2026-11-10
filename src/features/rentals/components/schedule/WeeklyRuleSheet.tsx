import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Time24Input } from "@/components/Time24Input"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { HH_MM } from "@/lib/time24"
import { InlineScheduleModule } from "./InlineScheduleModule"
import { scheduleChipClassName } from "./scheduleChipClassName"
import { occupancyKindDisplayLabel } from "@/features/rentals/lib/occupancyKindLabel"
import type { ScheduleBusyAction } from "@/features/rentals/components/schedule/DailyAgendaTab"
import {
  DAY_NAMES,
  type DayOfWeekName,
  type OccupancyKind,
} from "@/features/rentals/services/scheduleService"

export type WeeklyRuleDraft = {
  rentalAssetIds: readonly string[]
  daysOfWeek: readonly string[]
  openTime: string
  closeTime: string
  slotMinutes: number
  occupancyKindId: string
}

type WeeklyRuleBaseline = {
  days: readonly string[]
  openTime: string
  closeTime: string
  slotMinutes: number
  occupancyKindId: string
}

const RULE_OPEN_TIME = "08:00"
const RULE_CLOSE_TIME = "22:00"
const RULE_SLOT_MINUTES = 60

function weeklyRuleBaseline(weekday: string, kindId: string): WeeklyRuleBaseline {
  return {
    days: [weekday],
    openTime: RULE_OPEN_TIME,
    closeTime: RULE_CLOSE_TIME,
    slotMinutes: RULE_SLOT_MINUTES,
    occupancyKindId: kindId,
  }
}

function weeklyRuleIsDirty(current: WeeklyRuleBaseline, baseline: WeeklyRuleBaseline): boolean {
  if (current.slotMinutes !== baseline.slotMinutes) return true
  if (current.openTime !== baseline.openTime) return true
  if (current.closeTime !== baseline.closeTime) return true
  if (current.occupancyKindId !== baseline.occupancyKindId) return true
  if (current.days.length !== baseline.days.length) return true
  const left = [...current.days].sort()
  const right = [...baseline.days].sort()
  return left.some((day, index) => day !== right[index])
}

type WeeklyRuleSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRentalAssetIds: readonly string[]
  weekday: DayOfWeekName
  kinds: readonly OccupancyKind[]
  defaultKindId: string
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  onApply: (draft: WeeklyRuleDraft) => Promise<boolean>
  onDirtyChange?: (dirty: boolean) => void
  /** Collapse and other non-Cancel closes. Cancel discards without asking. */
  onRequestClose?: () => void
}

export function WeeklyRuleSheet({
  open,
  onOpenChange,
  selectedRentalAssetIds,
  weekday,
  kinds,
  defaultKindId,
  busy,
  busyAction,
  readOnly,
  onApply,
  onDirtyChange,
  onRequestClose,
}: WeeklyRuleSheetProps) {
  const { t } = useTranslation()
  const [days, setDays] = useState<string[]>([weekday])
  const [openTime, setOpenTime] = useState(RULE_OPEN_TIME)
  const [closeTime, setCloseTime] = useState(RULE_CLOSE_TIME)
  const [slotMinutes, setSlotMinutes] = useState(RULE_SLOT_MINUTES)
  const [occupancyKindId, setOccupancyKindId] = useState(defaultKindId)
  const [baseline, setBaseline] = useState<WeeklyRuleBaseline>(() => weeklyRuleBaseline(weekday, defaultKindId))
  const hasValidTimes = HH_MM.test(openTime) && HH_MM.test(closeTime)

  let currentDays = days
  let currentOpen = openTime
  let currentClose = closeTime
  let currentSlot = slotMinutes
  let currentKind = occupancyKindId
  let currentBaseline = baseline
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      const next = weeklyRuleBaseline(weekday, defaultKindId)
      currentDays = [...next.days]
      currentOpen = next.openTime
      currentClose = next.closeTime
      currentSlot = next.slotMinutes
      currentKind = next.occupancyKindId
      currentBaseline = next
      setDays(currentDays)
      setOpenTime(currentOpen)
      setCloseTime(currentClose)
      setSlotMinutes(currentSlot)
      setOccupancyKindId(currentKind)
      setBaseline(next)
    }
  }
  const ruleKindId = currentKind || defaultKindId
  const dirty = open && weeklyRuleIsDirty(
    {
      days: currentDays,
      openTime: currentOpen,
      closeTime: currentClose,
      slotMinutes: currentSlot,
      occupancyKindId: ruleKindId,
    },
    {
      ...currentBaseline,
      occupancyKindId: currentBaseline.occupancyKindId || defaultKindId,
    },
  )
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  return (
    <InlineScheduleModule
      title={t("rentals.schedule.weeklyRule.title")}
      description={t("rentals.schedule.weeklyRule.sheetHint")}
      icon={Repeat}
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
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {t("rentals.schedule.weeklyRule.days")}
          </legend>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((dayName) => {
              const checked = days.includes(dayName)
              return (
                <button
                  key={dayName}
                  type="button"
                  aria-pressed={checked}
                  disabled={busy || readOnly}
                  onClick={() =>
                    setDays((current) =>
                      checked
                        ? current.filter((day) => day !== dayName)
                        : [...current, dayName],
                    )
                  }
                  className={scheduleChipClassName(checked)}
                >
                  {t(`rentals.schedule.days.${dayName}`)}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">
            <span>{t("rentals.schedule.policy.openTime")}</span>
            <Time24Input
              value={openTime}
              disabled={busy || readOnly}
              onValueChange={(next) => setOpenTime(next)}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span>{t("rentals.schedule.policy.closeTime")}</span>
            <Time24Input
              value={closeTime}
              disabled={busy || readOnly}
              onValueChange={(next) => setCloseTime(next)}
            />
          </label>
        </div>
        <label className="block space-y-1 text-xs">
          <span>{t("rentals.schedule.policy.slotMinutes")}</span>
          <Input
            type="number"
            min={15}
            step={15}
            value={slotMinutes}
            disabled={busy || readOnly}
            onChange={(event) => setSlotMinutes(Number(event.target.value))}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium">{t("rentals.schedule.templates.kind")}</legend>
          <div className="flex flex-wrap gap-2">
            {kinds.filter((kind) => kind.isActive).map((kind) => (
              <button key={kind.id} type="button" aria-pressed={ruleKindId === kind.id} disabled={busy || readOnly} onClick={() => setOccupancyKindId(kind.id)} className={scheduleChipClassName(ruleKindId === kind.id)}>
                {occupancyKindDisplayLabel(t, kind)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          {t("common.cancel")}
        </Button>
        <LoadingButton
          type="button"
          loading={busyAction === "weeklyRule"}
          disabled={
            busy ||
            readOnly ||
            selectedRentalAssetIds.length === 0 ||
            days.length === 0 ||
            !ruleKindId ||
            !hasValidTimes ||
            slotMinutes < 1
          }
          onClick={() => {
            void onApply({
              rentalAssetIds: selectedRentalAssetIds,
              daysOfWeek: days,
              openTime,
              closeTime,
              slotMinutes,
              occupancyKindId: ruleKindId,
            }).then((ok) => {
              if (ok) {
                onOpenChange(false)
              }
            })
          }}
        >
          {t("rentals.schedule.weeklyRule.apply")}
        </LoadingButton>
      </footer>
    </InlineScheduleModule>
  )
}
