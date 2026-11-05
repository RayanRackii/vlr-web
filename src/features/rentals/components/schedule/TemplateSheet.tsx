import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Clock3 } from "lucide-react"

import { occupancyKindDisplayLabel } from "@/features/rentals/lib/occupancyKindLabel"
import { Button } from "@/components/ui/button"
import { Time24Input } from "@/components/Time24Input"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { HH_MM } from "@/lib/time24"
import { InlineScheduleModule } from "./InlineScheduleModule"
import { scheduleChipClassName } from "./scheduleChipClassName"
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

  if (!open) return null

  return (
    <InlineScheduleModule
      title={editing ? t("rentals.schedule.templates.saveEdit") : t("rentals.schedule.templates.saveCreate")}
      description={<>{assetName ? <span className="block font-medium text-foreground">{assetName}</span> : null}{t("rentals.schedule.weeklyCellHint")}</>}
      icon={Clock3}
      open={open}
      disabled={busy}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("rentals.schedule.templates.dayOfWeek")}</legend>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((dayName) => (
              <button key={dayName} type="button" aria-pressed={draft.dayOfWeek === dayName} disabled={readOnly || busy || lockDayOfWeek} onClick={() => setDraft((current) => ({ ...current, dayOfWeek: dayName }))} className={scheduleChipClassName(draft.dayOfWeek === dayName)}>
                {t(`rentals.schedule.days.${dayName}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("rentals.schedule.templates.kind")}</legend>
          <div className="flex flex-wrap gap-2">
            {kinds.filter((kind) => kind.isActive || kind.id === draft.occupancyKindId).map((kind) => (
              <button key={kind.id} type="button" aria-pressed={draft.occupancyKindId === kind.id} disabled={readOnly || busy} onClick={() => setDraft((current) => ({ ...current, occupancyKindId: kind.id }))} className={scheduleChipClassName(draft.occupancyKindId === kind.id)}>
                {occupancyKindDisplayLabel(t, kind)}
              </button>
            ))}
          </div>
        </fieldset>

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

      <footer className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
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
      </footer>
    </InlineScheduleModule>
  )
}
