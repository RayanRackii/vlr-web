import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
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
}: WeeklyRuleSheetProps) {
  const { t } = useTranslation()
  const [days, setDays] = useState<string[]>([weekday])
  const [openTime, setOpenTime] = useState("08:00")
  const [closeTime, setCloseTime] = useState("22:00")
  const [slotMinutes, setSlotMinutes] = useState(60)
  const [occupancyKindId, setOccupancyKindId] = useState(defaultKindId)
  const ruleKindId = occupancyKindId || defaultKindId

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDays([weekday])
          setOccupancyKindId(defaultKindId)
        }
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{t("rentals.schedule.weeklyRule.title")}</SheetTitle>
          <SheetDescription>
            {t("rentals.schedule.weeklyRule.sheetHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {t("rentals.schedule.weeklyRule.days")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {DAY_NAMES.map((dayName) => {
                const checked = days.includes(dayName)
                return (
                  <label key={dayName} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={checked}
                      disabled={busy || readOnly}
                      onChange={() =>
                        setDays((current) =>
                          checked
                            ? current.filter((day) => day !== dayName)
                            : [...current, dayName],
                        )
                      }
                    />
                    {t(`rentals.schedule.days.${dayName}`)}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs">
              <span>{t("rentals.schedule.policy.openTime")}</span>
              <Input
                type="time"
                value={openTime}
                disabled={busy || readOnly}
                onChange={(event) => setOpenTime(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs">
              <span>{t("rentals.schedule.policy.closeTime")}</span>
              <Input
                type="time"
                value={closeTime}
                disabled={busy || readOnly}
                onChange={(event) => setCloseTime(event.target.value)}
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
          <label className="block space-y-1 text-xs">
            <span>{t("rentals.schedule.templates.kind")}</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={ruleKindId}
              disabled={busy || readOnly}
              onChange={(event) => setOccupancyKindId(event.target.value)}
            >
              {kinds
                .filter((kind) => kind.isActive)
                .map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <SheetFooter>
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
              !openTime ||
              !closeTime ||
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
