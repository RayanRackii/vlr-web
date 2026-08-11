import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  kinds: readonly OccupancyKind[]
  defaultKindId: string
  busy: boolean
  readOnly: boolean
  onSubmit: (values: TemplateDraft) => Promise<boolean>
}

export function TemplateSheet({
  open,
  onOpenChange,
  editing,
  kinds,
  defaultKindId,
  busy,
  readOnly,
  onSubmit,
}: TemplateSheetProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<TemplateDraft>(
    emptyTemplateDraft(defaultKindId),
  )

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
    setDraft(emptyTemplateDraft(defaultKindId))
  }, [defaultKindId, editing, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {editing
              ? t("rentals.schedule.templates.saveEdit")
              : t("rentals.schedule.templates.saveCreate")}
          </SheetTitle>
          <SheetDescription>
            {t("rentals.schedule.templatesHint")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.templates.dayOfWeek")}
            </span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={draft.dayOfWeek}
              disabled={readOnly || busy}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  dayOfWeek: event.target.value,
                }))
              }}
            >
              {DAY_NAMES.map((dayName) => (
                <option key={dayName} value={dayName}>
                  {t(`rentals.schedule.days.${dayName}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              {t("rentals.schedule.templates.kind")}
            </span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={draft.occupancyKindId}
              disabled={readOnly || busy}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  occupancyKindId: event.target.value,
                }))
              }}
            >
              {kinds
                .filter(
                  (kind) =>
                    kind.isActive || kind.id === draft.occupancyKindId,
                )
                .map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">
                {t("rentals.schedule.templates.start")}
              </span>
              <Input
                type="time"
                value={draft.startTime}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">
                {t("rentals.schedule.templates.end")}
              </span>
              <Input
                type="time"
                value={draft.endTime}
                disabled={readOnly || busy}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    endTime: event.target.value,
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
          <Button
            type="button"
            disabled={busy || readOnly}
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
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
