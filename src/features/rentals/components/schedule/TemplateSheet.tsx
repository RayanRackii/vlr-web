import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Clock3 } from "lucide-react"

import { occupancyKindDisplayLabel } from "@/features/rentals/lib/occupancyKindLabel"
import { Button } from "@/components/ui/button"
import { Time24Input } from "@/components/Time24Input"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { HH_MM } from "@/lib/time24"
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
  emptyTemplateDraft,
  type TemplateDraft,
} from "@/features/rentals/components/schedule/scheduleFormDefaults"
import {
  DAY_NAMES,
  formatScheduleTime,
  type OccupancyKind,
  type ScheduleTemplate,
} from "@/features/rentals/services/scheduleService"

type TemplateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: ScheduleTemplate | null
  assetName?: string
  lockDayOfWeek?: boolean
  defaults?: Partial<TemplateDraft>
  kinds: readonly OccupancyKind[]
  defaultKindId: string
  busy: boolean
  busyAction: ScheduleBusyAction
  readOnly: boolean
  onSubmit: (values: TemplateDraft) => Promise<boolean>
  onDelete?: () => void
}

export function TemplateSheet({
  open,
  onOpenChange,
  editing,
  assetName,
  lockDayOfWeek = false,
  defaults,
  kinds,
  defaultKindId,
  busy,
  busyAction,
  readOnly,
  onSubmit,
  onDelete,
}: TemplateSheetProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TemplateDraft>(
    emptyTemplateDraft(defaultKindId),
  )
  const hasValidTimes =
    HH_MM.test(formatScheduleTime(draft.startTime)) && HH_MM.test(formatScheduleTime(draft.endTime))

  useEffect(() => {
    if (!open) {
      return
    }
    if (editing) {
      setDraft({
        dayOfWeek: editing.dayOfWeek,
        startTime: formatScheduleTime(editing.startTime),
        endTime: formatScheduleTime(editing.endTime),
        occupancyKindId: editing.occupancyKindId,
        label: editing.label ?? "",
        isActive: editing.isActive,
      })
      return
    }
    setDraft({
      ...emptyTemplateDraft(defaultKindId),
      ...defaults,
    })
  }, [
    defaultKindId,
    defaults?.dayOfWeek,
    defaults?.endTime,
    defaults?.occupancyKindId,
    defaults?.startTime,
    editing,
    open,
  ])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[420px]">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock3 className="size-4" aria-hidden />
            </span>
            <div className="space-y-0.5">
              <SheetTitle>
                {editing
                  ? t("rentals.schedule.templates.saveEdit")
                  : t("rentals.schedule.templates.saveCreate")}
              </SheetTitle>
              <SheetDescription>
                {assetName ? (
                  <span className="block font-medium text-foreground">{assetName}</span>
                ) : null}
                {t("rentals.schedule.weeklyCellHint")}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.templates.dayOfWeek")}
            </span>
            <Select
              modal={false}
              value={draft.dayOfWeek}
              disabled={readOnly || busy || lockDayOfWeek}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setDraft((current) => ({
                    ...current,
                    dayOfWeek: value,
                  }))
                }
              }}
              items={DAY_NAMES.map((dayName) => ({
                value: dayName,
                label: t(`rentals.schedule.days.${dayName}`),
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((dayName) => (
                  <SelectItem key={dayName} value={dayName}>
                    {t(`rentals.schedule.days.${dayName}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.templates.kind")}
            </span>
            <Select
              modal={false}
              value={draft.occupancyKindId || null}
              disabled={readOnly || busy}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setDraft((current) => ({
                    ...current,
                    occupancyKindId: value,
                  }))
                }
              }}
              items={kinds
                .filter(
                  (kind) =>
                    kind.isActive || kind.id === draft.occupancyKindId,
                )
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
                  .filter(
                    (kind) =>
                      kind.isActive || kind.id === draft.occupancyKindId,
                  )
                  .map((kind) => (
                    <SelectItem key={kind.id} value={kind.id}>
                      {occupancyKindDisplayLabel(t, kind)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">
                {t("rentals.schedule.templates.start")}
              </span>
              <Time24Input
                value={draft.startTime}
                disabled={readOnly || busy}
                onValueChange={(next) => {
                  setDraft((current) => ({
                    ...current,
                    startTime: next,
                  }))
                }}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">
                {t("rentals.schedule.templates.end")}
              </span>
              <Time24Input
                value={draft.endTime}
                disabled={readOnly || busy}
                onValueChange={(next) => {
                  setDraft((current) => ({
                    ...current,
                    endTime: next,
                  }))
                }}
              />
            </label>
          </div>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.templates.label")}
            </span>
            <Input
              value={draft.label}
              disabled={readOnly || busy}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={draft.isActive}
              disabled={readOnly || busy}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }}
            />
            {t("rentals.schedule.active")}
          </label>

          {editing && onDelete ? (
            <div className="border-t border-border pt-4">
              <LoadingButton
                type="button"
                variant="destructive"
                loading={busyAction === "templateDelete"}
                disabled={busy || readOnly}
                onClick={() => {
                  onDelete()
                }}
              >
                {t("common.delete")}
              </LoadingButton>
            </div>
          ) : null}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {t("common.cancel")}
          </Button>
          <LoadingButton
            type="button"
            loading={busyAction === "template"}
            disabled={busy || readOnly || !hasValidTimes}
            onClick={() => {
              void onSubmit(draft).then((ok) => {
                if (ok) {
                  onOpenChange(false)
                }
              })
            }}
          >
            {editing
              ? t("rentals.schedule.templates.saveEdit")
              : t("rentals.schedule.templates.saveCreate")}
          </LoadingButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
