import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Repeat } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Time24Input } from "@/components/Time24Input"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { HH_MM } from "@/lib/time24"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  const hasValidTimes = HH_MM.test(openTime) && HH_MM.test(closeTime)

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
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Repeat className="size-4" aria-hidden />
            </span>
            <div className="space-y-0.5">
              <SheetTitle>{t("rentals.schedule.weeklyRule.title")}</SheetTitle>
              <SheetDescription>
                {t("rentals.schedule.weeklyRule.sheetHint")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
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
                    className={cn(
                      "min-h-10 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                      checked
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
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
          <label className="block space-y-1 text-xs">
            <span>{t("rentals.schedule.templates.kind")}</span>
            <Select
              modal={false}
              value={ruleKindId || null}
              disabled={busy || readOnly}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setOccupancyKindId(value)
                }
              }}
              items={kinds
                .filter((kind) => kind.isActive)
                .map((kind) => ({
                  value: kind.id,
                  label: kind.label,
                }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds
                  .filter((kind) => kind.isActive)
                  .map((kind) => (
                    <SelectItem key={kind.id} value={kind.id}>
                      {kind.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
